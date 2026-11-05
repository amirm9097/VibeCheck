import logging
from urllib.parse import urlsplit
from celery import shared_task
from django.core.files.base import ContentFile
from django.utils import timezone
from .models import Analysis
from .services.analyzer import run_website_analysis

logger = logging.getLogger(__name__)

@shared_task(bind=True, max_retries=0, soft_time_limit=160, time_limit=180)
def analyze_website(self, analysis_id: str):
    try:
        analysis = Analysis.objects.get(pk=analysis_id)
        analysis.status = Analysis.Status.RUNNING
        analysis.started_at = timezone.now()
        analysis.error_code = ""
        analysis.error_message = ""
        analysis.save(update_fields=["status", "started_at", "error_code", "error_message", "updated_at"])
        result = run_website_analysis(analysis.normalized_url)
        analysis.normalized_url = result["url"]
        analysis.domain = urlsplit(result["url"]).hostname or analysis.domain
        analysis.title = result["title"][:300]
        analysis.overall_score = result["overall_score"]
        analysis.scores = result["scores"]
        analysis.metrics = result["metrics"]
        analysis.lighthouse = result["lighthouse"]
        analysis.findings = result["findings"]
        analysis.positives = result["positives"]
        analysis.recommendations = result["recommendations"]
        analysis.summary = result["summary"][:6000]
        analysis.ai_status = result["ai_status"]
        analysis.desktop_screenshot.save(f"{analysis.id}-desktop.png", ContentFile(result["desktop_screenshot"]), save=False)
        analysis.mobile_screenshot.save(f"{analysis.id}-mobile.png", ContentFile(result["mobile_screenshot"]), save=False)
        analysis.status = Analysis.Status.COMPLETED
        analysis.completed_at = timezone.now()
        analysis.save()
        return {"analysis_id": str(analysis.id), "status": "completed"}
    except Analysis.DoesNotExist:
        logger.error("Analysis %s disappeared before task execution", analysis_id)
        return {"analysis_id": analysis_id, "status": "missing"}
    except Exception as exc:
        logger.exception("Website analysis %s failed", analysis_id)
        try:
            analysis = Analysis.objects.get(pk=analysis_id)
            analysis.status = Analysis.Status.FAILED
            analysis.error_code = "analysis_failed"
            analysis.error_message = "The inspection could not be completed. The site may block automated browsers or exceed the analysis time limit. Check the URL and retry."
            analysis.completed_at = timezone.now()
            analysis.save(update_fields=["status", "error_code", "error_message", "completed_at", "updated_at"])
        except Analysis.DoesNotExist:
            pass
        return {"analysis_id": analysis_id, "status": "failed", "reason": type(exc).__name__}
