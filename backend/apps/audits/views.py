import io
import logging
import uuid
from datetime import timedelta
from urllib.parse import urlsplit

from django.contrib.auth import get_user_model
from django.db import transaction, IntegrityError
from django.db.models import Avg, Count, Q
from django.http import FileResponse, Http404, HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from django.core.exceptions import ValidationError as DjangoValidationError
from rest_framework import filters, permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import ValidationError, PermissionDenied
from rest_framework.parsers import JSONParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination
from rest_framework.throttling import UserRateThrottle
from drf_spectacular.utils import extend_schema, OpenApiParameter
from reportlab.lib import colors
from reportlab.lib.enums import TA_LEFT
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import mm
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, KeepTogether
from xml.sax.saxutils import escape

from .models import Analysis, SavedWebsite, Comparison, AIProviderConfig, UsagePolicy
from .serializers import AnalysisSerializer, SavedWebsiteSerializer, ComparisonCreateSerializer
from .services.ai import encrypt_secret
from .tasks import analyze_website

logger = logging.getLogger(__name__)
User = get_user_model()

class HealthView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    throttle_classes = []
    def get(self, request):
        return Response({"status": "ok", "service": "vibecheck-api"})

class AnalysisRateThrottle(UserRateThrottle):
    scope = "analysis"

class AnalysisViewSet(viewsets.ModelViewSet):
    serializer_class = AnalysisSerializer
    throttle_classes = [AnalysisRateThrottle]
    filterset_fields = ["status", "is_favorite"]
    search_fields = ["url", "domain", "title"]
    ordering_fields = ["created_at", "overall_score", "domain"]
    ordering = ["-created_at"]
    http_method_names = ["get", "post", "patch", "head", "options"]
    def get_queryset(self):
        qs = Analysis.objects.select_related("user")
        if self.request.user.is_staff:
            # Normal users never reach the admin-only action through this viewset; their history remains isolated.
            return qs.filter(user=self.request.user)
        return qs.filter(user=self.request.user)
    def perform_create(self, serializer):
        # Serialize concurrent submissions per account so parallel requests cannot
        # exceed the daily quota while each sees the same pre-insert count.
        with transaction.atomic():
            User.objects.select_for_update().only("pk").get(pk=self.request.user.pk)
            policy = UsagePolicy.get_solo()
            today_start = timezone.localdate()
            used = Analysis.objects.filter(user=self.request.user, created_at__date=today_start).count()
            if used >= policy.daily_analysis_limit:
                raise ValidationError({"limit": f"Daily analysis limit reached ({policy.daily_analysis_limit}). Try again tomorrow."})
            analysis = serializer.save(
                user=self.request.user,
                domain=urlsplit(serializer.validated_data["url"]).hostname or "",
                normalized_url=serializer.validated_data["url"],
            )
        # Enqueue only after the analysis row has committed, so a fast worker can
        # always load it. A queue outage is persisted as a visible failed job.
        try:
            task = analyze_website.delay(str(analysis.id))
            analysis.task_id = task.id
            analysis.save(update_fields=["task_id", "updated_at"])
        except Exception:
            logger.exception("Could not enqueue analysis %s", analysis.id)
            analysis.status = Analysis.Status.FAILED
            analysis.error_code = "queue_unavailable"
            analysis.error_message = "The analysis queue is unavailable. Please retry shortly."
            analysis.completed_at = timezone.now()
            analysis.save(update_fields=["status", "error_code", "error_message", "completed_at", "updated_at"])
    @action(detail=True, methods=["post"])
    def retry(self, request, pk=None):
        analysis = self.get_object()
        if analysis.status != Analysis.Status.FAILED:
            raise ValidationError("Only failed analyses can be retried.")
        analysis.status = Analysis.Status.QUEUED
        analysis.error_code = ""
        analysis.error_message = ""
        analysis.completed_at = None
        analysis.started_at = None
        analysis.save(update_fields=["status", "error_code", "error_message", "completed_at", "started_at", "updated_at"])
        try:
            task = analyze_website.delay(str(analysis.id))
            analysis.task_id = task.id
            analysis.save(update_fields=["task_id", "updated_at"])
        except Exception:
            analysis.status = Analysis.Status.FAILED
            analysis.error_code = "queue_unavailable"
            analysis.error_message = "The analysis queue is unavailable. Please retry shortly."
            analysis.save(update_fields=["status", "error_code", "error_message", "updated_at"])
            raise ValidationError("The analysis queue is unavailable.")
        return Response(AnalysisSerializer(analysis, context={"request": request}).data, status=202)
    @action(detail=True, methods=["post"])
    def share(self, request, pk=None):
        analysis = self.get_object()
        policy = UsagePolicy.get_solo()
        if not policy.allow_public_shares:
            raise PermissionDenied("Public report sharing is disabled by the administrator.")
        if analysis.status != Analysis.Status.COMPLETED:
            raise ValidationError("Only completed reports can be shared.")
        if not analysis.share_token:
            analysis.share_token = uuid.uuid4()
            analysis.save(update_fields=["share_token", "updated_at"])
        return Response({"token": str(analysis.share_token), "url": f"/shared/{analysis.share_token}"})
    @action(detail=True, methods=["get"], url_path=r"screenshot/(?P<kind>desktop|mobile)")
    def screenshot(self, request, pk=None, kind=None):
        analysis = self.get_object()
        image = analysis.desktop_screenshot if kind == "desktop" else analysis.mobile_screenshot
        if not image:
            raise Http404("Screenshot is not available")
        return FileResponse(image.open("rb"), content_type="image/png", filename=f"{analysis.domain}-{kind}.png")
    @action(detail=True, methods=["get"], url_path="export.json")
    def export_json(self, request, pk=None):
        analysis = self.get_object()
        if analysis.status != Analysis.Status.COMPLETED:
            raise ValidationError("The report is not ready to export.")
        import json
        payload = AnalysisSerializer(analysis, context={"request": request}).data
        response = HttpResponse(json.dumps(payload, ensure_ascii=False, indent=2), content_type="application/json; charset=utf-8")
        response["Content-Disposition"] = f'attachment; filename="vibecheck-{analysis.domain}.json"'
        response["Cache-Control"] = "private, no-store"
        return response

    @action(detail=True, methods=["get"], url_path="export.pdf")
    def export_pdf(self, request, pk=None):
        analysis = self.get_object()
        if analysis.status != Analysis.Status.COMPLETED:
            raise ValidationError("The report is not ready to export.")
        buffer = io.BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=18*mm, leftMargin=18*mm, topMargin=17*mm, bottomMargin=17*mm)
        styles = getSampleStyleSheet()
        styles.add(ParagraphStyle(name="Subtle", parent=styles["Normal"], textColor=colors.HexColor("#65716C"), fontSize=9, leading=13))
        styles.add(ParagraphStyle(name="Finding", parent=styles["Heading3"], fontSize=11, leading=14, spaceBefore=8, spaceAfter=3))
        story = [Paragraph("VIBECHECK · WEBSITE QUALITY REPORT", styles["Kicker"] if "Kicker" in styles else styles["Heading2"]), Spacer(1, 5*mm)]
        story += [Paragraph(escape(analysis.title or analysis.domain), styles["Title"]), Paragraph(escape(analysis.normalized_url), styles["Subtle"]), Spacer(1, 4*mm)]
        score_text = "Not available" if analysis.overall_score is None else f"{analysis.overall_score}/100"
        story += [Paragraph(f"Overall Vibe Score: <b>{score_text}</b>", styles["Heading2"]), Paragraph(escape(analysis.summary), styles["BodyText"]), Spacer(1, 5*mm)]
        rows = [["Category", "Score", "Scoring method"]]
        for key, item in analysis.scores.items():
            label = key.replace("_", " ").title()
            rows.append([label, "—" if item.get("score") is None else f"{item['score']}/100", item.get("method", "")])
        table = Table(rows, colWidths=[40*mm, 22*mm, 105*mm], repeatRows=1)
        table.setStyle(TableStyle([("BACKGROUND", (0,0), (-1,0), colors.HexColor("#172522")), ("TEXTCOLOR", (0,0), (-1,0), colors.white), ("FONTNAME", (0,0), (-1,0), "Helvetica-Bold"), ("FONTSIZE", (0,0), (-1,-1), 8), ("LEADING", (0,0), (-1,-1), 11), ("GRID", (0,0), (-1,-1), .35, colors.HexColor("#D9DFD8")), ("ROWBACKGROUNDS", (0,1), (-1,-1), [colors.white, colors.HexColor("#F4F6F2")]), ("VALIGN", (0,0), (-1,-1), "TOP"), ("LEFTPADDING", (0,0), (-1,-1), 7), ("RIGHTPADDING", (0,0), (-1,-1), 7), ("TOPPADDING", (0,0), (-1,-1), 7), ("BOTTOMPADDING", (0,0), (-1,-1), 7)]))
        story += [table, Spacer(1, 6*mm), Paragraph("Findings", styles["Heading2"])]
        if not analysis.findings:
            story.append(Paragraph("No measured findings were recorded.", styles["BodyText"]))
        for finding in analysis.findings:
            origin = "AI judgment" if finding.get("source") == "ai_judgment" else "Measured"
            block = [Paragraph(escape(f"{finding.get('title','Finding')} · {finding.get('severity','').upper()} · {origin}"), styles["Finding"]), Paragraph(escape(finding.get("description", "")), styles["BodyText"]), Paragraph("Evidence: " + escape(finding.get("evidence", "—")), styles["Subtle"]), Paragraph("Recommended action: " + escape(finding.get("recommendation", "—")), styles["BodyText"])]
            story.append(KeepTogether(block))
        if analysis.positives:
            story += [Spacer(1, 5*mm), Paragraph("What is working", styles["Heading2"])]
            story.append(Paragraph(" • ".join(escape(x) for x in analysis.positives), styles["BodyText"]))
        story += [Spacer(1, 8*mm), Paragraph("Scoring note: rule-based categories deduct 3/6/12/20 points per low/medium/high/critical measured finding. Performance uses the Lighthouse Performance category. AI judgments are shown separately and never alter the numeric scores. The accessibility checks are heuristic and are not a certification.", styles["Subtle"])]
        doc.build(story)
        buffer.seek(0)
        return FileResponse(buffer, as_attachment=True, filename=f"vibecheck-{analysis.domain}.pdf", content_type="application/pdf")

class SavedWebsiteViewSet(viewsets.ModelViewSet):
    serializer_class = SavedWebsiteSerializer
    http_method_names = ["get", "post", "delete", "head", "options"]
    def get_queryset(self):
        return SavedWebsite.objects.filter(user=self.request.user)
    def perform_create(self, serializer):
        try:
            serializer.save()
        except IntegrityError as exc:
            raise ValidationError({"url": "This domain is already in your saved websites."}) from exc

class ComparisonView(APIView):
    def get(self, request):
        items = Comparison.objects.filter(user=request.user).prefetch_related("analyses")[:50]
        return Response([{"id": str(c.id), "name": c.name, "created_at": c.created_at, "analysis_ids": [str(a.id) for a in c.analyses.all()], "domains": [a.domain for a in c.analyses.all()]} for c in items])
    def post(self, request):
        serializer = ComparisonCreateSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        ids = serializer.validated_data["analysis_ids"]
        policy = UsagePolicy.get_solo()
        if len(ids) > policy.max_comparison_sites:
            raise ValidationError({"analysis_ids": f"You can compare up to {policy.max_comparison_sites} websites."})
        analyses = list(Analysis.objects.filter(user=request.user, id__in=ids, status=Analysis.Status.COMPLETED))
        by_id = {str(a.id): a for a in analyses}
        comparison = Comparison.objects.create(user=request.user, name=serializer.validated_data.get("name", ""))
        comparison.analyses.set([by_id[str(i)] for i in ids])
        return Response(self.serialize(comparison), status=201)
    @staticmethod
    def serialize(obj):
        analyses = obj.analyses.all()
        return {"id": str(obj.id), "name": obj.name, "created_at": obj.created_at, "analyses": AnalysisSerializer(analyses, many=True).data}

class ComparisonDetailView(APIView):
    def get(self, request, pk):
        comparison = get_object_or_404(Comparison.objects.prefetch_related("analyses"), pk=pk, user=request.user)
        return Response(ComparisonView.serialize(comparison))
    def delete(self, request, pk):
        comparison = get_object_or_404(Comparison, pk=pk, user=request.user)
        comparison.delete()
        return Response(status=204)

class PublicSharedReportView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    def get(self, request, token):
        if not UsagePolicy.get_solo().allow_public_shares:
            raise Http404("Public report sharing is disabled")
        analysis = get_object_or_404(Analysis, share_token=token, status=Analysis.Status.COMPLETED)
        return Response(AnalysisSerializer(analysis, context={"request": request}).data)


class PublicSharedScreenshotView(APIView):
    permission_classes = [permissions.AllowAny]
    authentication_classes = []
    def get(self, request, token, kind):
        if kind not in {"desktop", "mobile"} or not UsagePolicy.get_solo().allow_public_shares:
            raise Http404("Public screenshot is not available")
        analysis = get_object_or_404(Analysis, share_token=token, status=Analysis.Status.COMPLETED)
        image = analysis.desktop_screenshot if kind == "desktop" else analysis.mobile_screenshot
        if not image:
            raise Http404("Screenshot is not available")
        return FileResponse(image.open("rb"), content_type="image/png", filename=f"{analysis.domain}-{kind}.png")

class AdminOverviewView(APIView):
    permission_classes = [permissions.IsAdminUser]
    def get(self, request):
        since = timezone.now() - timedelta(hours=24)
        completed = Analysis.objects.filter(status=Analysis.Status.COMPLETED)
        avg_score = completed.aggregate(value=Avg("overall_score"))["value"]
        return Response({
            "users": User.objects.count(), "analyses_total": Analysis.objects.count(),
            "analyses_24h": Analysis.objects.filter(created_at__gte=since).count(),
            "queued": Analysis.objects.filter(status=Analysis.Status.QUEUED).count(),
            "running": Analysis.objects.filter(status=Analysis.Status.RUNNING).count(),
            "failed": Analysis.objects.filter(status=Analysis.Status.FAILED).count(),
            "completed": completed.count(), "average_score": round(avg_score, 1) if avg_score is not None else None,
        })

class AdminAnalysesView(APIView):
    permission_classes = [permissions.IsAdminUser]
    def get(self, request):
        qs = Analysis.objects.select_related("user").order_by("-created_at")
        status_value = request.query_params.get("status")
        search = request.query_params.get("q")
        if status_value: qs = qs.filter(status=status_value)
        if search: qs = qs.filter(Q(url__icontains=search) | Q(user__email__icontains=search) | Q(domain__icontains=search))
        pager = PageNumberPagination(); pager.page_size = 25
        page = pager.paginate_queryset(qs, request, view=self)
        data = [{"id": str(a.id), "url": a.url, "domain": a.domain, "status": a.status, "user_email": a.user.email, "created_at": a.created_at, "error_message": a.error_message, "overall_score": a.overall_score} for a in page]
        return pager.get_paginated_response(data)

class AdminUsersView(APIView):
    permission_classes = [permissions.IsAdminUser]
    def get(self, request):
        qs = User.objects.annotate(analysis_count=Count("analyses")).order_by("-date_joined")
        search = request.query_params.get("q")
        if search: qs = qs.filter(Q(email__icontains=search) | Q(display_name__icontains=search))
        pager = PageNumberPagination(); pager.page_size = 25
        page = pager.paginate_queryset(qs, request, view=self)
        data = [{"id": u.id, "email": u.email, "display_name": u.display_name, "role": u.role, "is_active": u.is_active, "date_joined": u.date_joined, "analysis_count": u.analysis_count} for u in page]
        return pager.get_paginated_response(data)
    def patch(self, request, pk):
        user = get_object_or_404(User, pk=pk)
        if user.is_superuser and user.pk != request.user.pk:
            raise PermissionDenied("Another superuser cannot be modified here.")
        if user.pk == request.user.pk and request.data.get("is_active") is False:
            raise ValidationError({"is_active": "You cannot disable your own account."})
        if user.pk == request.user.pk and "role" in request.data and request.data["role"] != user.role:
            raise PermissionDenied("You cannot change your own administrator role.")
        if "is_active" in request.data:
            if not isinstance(request.data["is_active"], bool):
                raise ValidationError({"is_active": "A boolean value is required."})
            user.is_active = request.data["is_active"]
        if "role" in request.data:
            if request.data["role"] not in ("user", "admin"):
                raise ValidationError({"role": "Role must be user or admin."})
            user.role = request.data["role"]
            user.is_staff = user.role == "admin"
        user.save(update_fields=["is_active", "role", "is_staff"])
        return Response({"id": user.id, "email": user.email, "role": user.role, "is_active": user.is_active})

class AdminRetryAnalysisView(APIView):
    permission_classes = [permissions.IsAdminUser]
    def post(self, request, pk):
        analysis = get_object_or_404(Analysis, pk=pk, status=Analysis.Status.FAILED)
        analysis.status = Analysis.Status.QUEUED
        analysis.error_code = ""
        analysis.error_message = ""
        analysis.completed_at = None
        analysis.started_at = None
        analysis.save(update_fields=["status", "error_code", "error_message", "completed_at", "started_at", "updated_at"])
        try:
            task = analyze_website.delay(str(analysis.id))
            analysis.task_id = task.id
            analysis.save(update_fields=["task_id", "updated_at"])
        except Exception:
            logger.exception("Admin could not enqueue retry for analysis %s", analysis.id)
            analysis.status = Analysis.Status.FAILED
            analysis.error_code = "queue_unavailable"
            analysis.error_message = "The analysis queue is unavailable. Please retry shortly."
            analysis.completed_at = timezone.now()
            analysis.save(update_fields=["status", "error_code", "error_message", "completed_at", "updated_at"])
            raise ValidationError("The analysis queue is unavailable.")
        return Response({"id": str(analysis.id), "status": analysis.status}, status=202)

class AdminSettingsView(APIView):
    permission_classes = [permissions.IsAdminUser]
    def get(self, request):
        ai = AIProviderConfig.get_solo(); policy = UsagePolicy.get_solo()
        return Response({"ai": {"provider": ai.provider, "base_url": ai.base_url, "model": ai.model, "enabled": ai.enabled, "api_key_configured": bool(ai.encrypted_api_key)}, "usage": {"daily_analysis_limit": policy.daily_analysis_limit, "max_comparison_sites": policy.max_comparison_sites, "allow_public_shares": policy.allow_public_shares}})
    def put(self, request):
        ai = AIProviderConfig.get_solo(); policy = UsagePolicy.get_solo()
        ai_data = request.data.get("ai", {})
        usage_data = request.data.get("usage", {})
        if not isinstance(ai_data, dict) or not isinstance(usage_data, dict):
            raise ValidationError("The ai and usage settings must be JSON objects.")
        if ai_data:
            provider = ai_data.get("provider", ai.provider)
            if provider != "openai_compatible":
                raise ValidationError({"ai.provider": "Unsupported provider."})
            base_url = str(ai_data.get("base_url", ai.base_url)).strip()
            from django.core.validators import URLValidator
            try:
                URLValidator(schemes=["https"])(base_url)
                parsed_base = urlsplit(base_url)
                if (
                    not parsed_base.hostname
                    or parsed_base.username
                    or parsed_base.password
                    or parsed_base.port not in (None, 443)
                    or parsed_base.query
                    or parsed_base.fragment
                ):
                    raise ValueError("credentials, query, fragment, or non-standard port")
            except (DjangoValidationError, ValueError):
                raise ValidationError({"ai.base_url": "Use a valid HTTPS API URL on standard port 443, without embedded credentials."})
            model = str(ai_data.get("model", ai.model)).strip()
            if not model or len(model) > 120:
                raise ValidationError({"ai.model": "Enter a model name up to 120 characters."})
            ai.provider = provider
            ai.base_url = base_url
            ai.model = model
            if ai_data.get("api_key"):
                api_key = ai_data["api_key"]
                if not isinstance(api_key, str) or len(api_key) > 8192:
                    raise ValidationError({"ai.api_key": "The API key must be a string of at most 8192 characters."})
                ai.encrypted_api_key = encrypt_secret(api_key)
            if "enabled" in ai_data:
                if not isinstance(ai_data["enabled"], bool):
                    raise ValidationError({"ai.enabled": "A boolean value is required."})
                ai.enabled = ai_data["enabled"]
            ai.save()
        if usage_data:
            try:
                if "daily_analysis_limit" in usage_data:
                    policy.daily_analysis_limit = max(1, min(500, int(usage_data["daily_analysis_limit"])))
                if "max_comparison_sites" in usage_data:
                    policy.max_comparison_sites = max(2, min(4, int(usage_data["max_comparison_sites"])))
            except (TypeError, ValueError):
                raise ValidationError({"usage": "Analysis and comparison limits must be whole numbers."})
            if "allow_public_shares" in usage_data:
                if not isinstance(usage_data["allow_public_shares"], bool):
                    raise ValidationError({"usage.allow_public_shares": "A boolean value is required."})
                policy.allow_public_shares = usage_data["allow_public_shares"]
            policy.save()
        return self.get(request)
