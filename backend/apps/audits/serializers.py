from urllib.parse import urlsplit
from rest_framework import serializers
from django.core.exceptions import ValidationError as DjangoValidationError
from .models import Analysis, SavedWebsite, Comparison
from .services.url_guard import validate_public_url


class AnalysisSerializer(serializers.ModelSerializer):
    screenshot_available = serializers.SerializerMethodField()

    class Meta:
        model = Analysis
        fields = (
            "id", "url", "normalized_url", "domain", "title",
            "status", "overall_score", "scores", "metrics",
            "lighthouse", "findings", "positives",
            "recommendations", "summary", "ai_status",
            "is_favorite", "screenshot_available",
            "error_code", "error_message", "created_at",
            "started_at", "completed_at",
        )
        read_only_fields = tuple(
            field for field in fields
            if field not in ("url", "is_favorite")
        )

    def get_extra_kwargs(self):
        extra_kwargs = super().get_extra_kwargs()
        if self.instance is not None:
            extra_kwargs["url"] = {"read_only": True}
        return extra_kwargs

    def get_screenshot_available(self, obj):
        return bool(obj.desktop_screenshot and obj.mobile_screenshot)

    def validate_url(self, value):
        try:
            return validate_public_url(value, resolve=False)
        except DjangoValidationError as exc:
            raise serializers.ValidationError(
                getattr(exc, "message_dict", exc.messages)
            ) from exc

class SavedWebsiteSerializer(serializers.ModelSerializer):
    class Meta:
        model = SavedWebsite
        fields = ("id", "url", "domain", "label", "created_at")
        read_only_fields = ("id", "domain", "created_at")
    def validate_url(self, value):
        try: return validate_public_url(value, resolve=False)
        except DjangoValidationError as exc: raise serializers.ValidationError(getattr(exc, "message_dict", exc.messages)) from exc
    def create(self, validated_data):
        host = urlsplit(validated_data["url"]).hostname or ""
        return SavedWebsite.objects.create(user=self.context["request"].user, domain=host, **validated_data)

class ComparisonCreateSerializer(serializers.Serializer):
    name = serializers.CharField(max_length=160, required=False, allow_blank=True)
    analysis_ids = serializers.ListField(child=serializers.UUIDField(), min_length=2, max_length=4)
    def validate_analysis_ids(self, value):
        if len(set(value)) != len(value):
            raise serializers.ValidationError("Choose each analysis only once.")
        qs = Analysis.objects.filter(user=self.context["request"].user, id__in=value, status=Analysis.Status.COMPLETED)
        if qs.count() != len(value):
            raise serializers.ValidationError("All selected reports must belong to you and be completed.")
        return value
