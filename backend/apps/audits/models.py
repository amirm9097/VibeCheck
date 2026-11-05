import uuid
from django.conf import settings
from django.db import models
from django.utils import timezone

class Analysis(models.Model):
    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        RUNNING = "running", "Running"
        COMPLETED = "completed", "Completed"
        FAILED = "failed", "Failed"
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="analyses")
    url = models.URLField(max_length=2048)
    normalized_url = models.URLField(max_length=2048)
    domain = models.CharField(max_length=253, db_index=True)
    title = models.CharField(max_length=300, blank=True)
    status = models.CharField(max_length=16, choices=Status.choices, default=Status.QUEUED, db_index=True)
    task_id = models.CharField(max_length=100, blank=True)
    overall_score = models.PositiveSmallIntegerField(null=True, blank=True)
    scores = models.JSONField(default=dict, blank=True)
    metrics = models.JSONField(default=dict, blank=True)
    lighthouse = models.JSONField(default=dict, blank=True)
    findings = models.JSONField(default=list, blank=True)
    positives = models.JSONField(default=list, blank=True)
    recommendations = models.JSONField(default=list, blank=True)
    summary = models.TextField(blank=True)
    desktop_screenshot = models.ImageField(upload_to="audits/%Y/%m/%d/desktop/", null=True, blank=True)
    mobile_screenshot = models.ImageField(upload_to="audits/%Y/%m/%d/mobile/", null=True, blank=True)
    ai_status = models.CharField(max_length=24, default="not_configured")
    is_favorite = models.BooleanField(default=False, db_index=True)
    share_token = models.UUIDField(null=True, blank=True, unique=True)
    error_code = models.CharField(max_length=80, blank=True)
    error_message = models.TextField(blank=True)
    created_at = models.DateTimeField(default=timezone.now, db_index=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    class Meta:
        ordering = ["-created_at"]
        indexes = [models.Index(fields=["user", "created_at"]), models.Index(fields=["user", "status"])]
    def __str__(self):
        return f"{self.domain} · {self.status}"

class SavedWebsite(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="saved_websites")
    url = models.URLField(max_length=2048)
    domain = models.CharField(max_length=253)
    label = models.CharField(max_length=120, blank=True)
    created_at = models.DateTimeField(default=timezone.now)
    class Meta:
        ordering = ["-created_at"]
        constraints = [models.UniqueConstraint(fields=["user", "domain"], name="unique_saved_website_per_user")]
    def __str__(self):
        return self.label or self.domain

class Comparison(models.Model):
    id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="comparisons")
    name = models.CharField(max_length=160, blank=True)
    analyses = models.ManyToManyField(Analysis, related_name="comparisons")
    created_at = models.DateTimeField(default=timezone.now)
    class Meta:
        ordering = ["-created_at"]
    def __str__(self):
        return self.name or f"Comparison · {self.created_at:%Y-%m-%d}"

class AIProviderConfig(models.Model):
    PROVIDERS = [("openai_compatible", "OpenAI-compatible API")]
    provider = models.CharField(max_length=32, choices=PROVIDERS, default="openai_compatible")
    base_url = models.URLField(max_length=500, default="https://api.openai.com/v1")
    model = models.CharField(max_length=120, default="gpt-4o-mini")
    encrypted_api_key = models.TextField(blank=True)
    enabled = models.BooleanField(default=False)
    updated_at = models.DateTimeField(auto_now=True)
    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
    def __str__(self):
        return f"AI provider · {self.provider}"

class UsagePolicy(models.Model):
    daily_analysis_limit = models.PositiveIntegerField(default=8)
    max_comparison_sites = models.PositiveSmallIntegerField(default=4)
    allow_public_shares = models.BooleanField(default=True)
    updated_at = models.DateTimeField(auto_now=True)
    @classmethod
    def get_solo(cls):
        obj, _ = cls.objects.get_or_create(pk=1)
        return obj
