import uuid
import django.db.models.deletion
import django.utils.timezone
from django.conf import settings
from django.db import migrations, models

class Migration(migrations.Migration):
    initial = True
    dependencies = [migrations.swappable_dependency(settings.AUTH_USER_MODEL)]
    operations = [
        migrations.CreateModel(
            name="AIProviderConfig",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("provider", models.CharField(choices=[("openai_compatible", "OpenAI-compatible API")], default="openai_compatible", max_length=32)),
                ("base_url", models.URLField(default="https://api.openai.com/v1", max_length=500)),
                ("model", models.CharField(default="gpt-4o-mini", max_length=120)),
                ("encrypted_api_key", models.TextField(blank=True)),
                ("enabled", models.BooleanField(default=False)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name="UsagePolicy",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("daily_analysis_limit", models.PositiveIntegerField(default=8)),
                ("max_comparison_sites", models.PositiveSmallIntegerField(default=4)),
                ("allow_public_shares", models.BooleanField(default=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
            ],
        ),
        migrations.CreateModel(
            name="Analysis",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("url", models.URLField(max_length=2048)),
                ("normalized_url", models.URLField(max_length=2048)),
                ("domain", models.CharField(db_index=True, max_length=253)),
                ("title", models.CharField(blank=True, max_length=300)),
                ("status", models.CharField(choices=[("queued", "Queued"), ("running", "Running"), ("completed", "Completed"), ("failed", "Failed")], db_index=True, default="queued", max_length=16)),
                ("task_id", models.CharField(blank=True, max_length=100)),
                ("overall_score", models.PositiveSmallIntegerField(blank=True, null=True)),
                ("scores", models.JSONField(blank=True, default=dict)),
                ("metrics", models.JSONField(blank=True, default=dict)),
                ("lighthouse", models.JSONField(blank=True, default=dict)),
                ("findings", models.JSONField(blank=True, default=list)),
                ("positives", models.JSONField(blank=True, default=list)),
                ("recommendations", models.JSONField(blank=True, default=list)),
                ("summary", models.TextField(blank=True)),
                ("desktop_screenshot", models.ImageField(blank=True, null=True, upload_to="audits/%Y/%m/%d/desktop/")),
                ("mobile_screenshot", models.ImageField(blank=True, null=True, upload_to="audits/%Y/%m/%d/mobile/")),
                ("ai_status", models.CharField(default="not_configured", max_length=24)),
                ("is_favorite", models.BooleanField(db_index=True, default=False)),
                ("share_token", models.UUIDField(blank=True, null=True, unique=True)),
                ("error_code", models.CharField(blank=True, max_length=80)),
                ("error_message", models.TextField(blank=True)),
                ("created_at", models.DateTimeField(db_index=True, default=django.utils.timezone.now)),
                ("started_at", models.DateTimeField(blank=True, null=True)),
                ("completed_at", models.DateTimeField(blank=True, null=True)),
                ("updated_at", models.DateTimeField(auto_now=True)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="analyses", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="SavedWebsite",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("url", models.URLField(max_length=2048)),
                ("domain", models.CharField(max_length=253)),
                ("label", models.CharField(blank=True, max_length=120)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="saved_websites", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.CreateModel(
            name="Comparison",
            fields=[
                ("id", models.UUIDField(default=uuid.uuid4, editable=False, primary_key=True, serialize=False)),
                ("name", models.CharField(blank=True, max_length=160)),
                ("created_at", models.DateTimeField(default=django.utils.timezone.now)),
                ("analyses", models.ManyToManyField(related_name="comparisons", to="audits.analysis")),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="comparisons", to=settings.AUTH_USER_MODEL)),
            ],
            options={"ordering": ["-created_at"]},
        ),
        migrations.AddConstraint(
            model_name="savedwebsite",
            constraint=models.UniqueConstraint(fields=("user", "domain"), name="unique_saved_website_per_user"),
        ),
        migrations.AddIndex(model_name="analysis", index=models.Index(fields=["user", "created_at"], name="aud_analysis_user_created_idx")),
        migrations.AddIndex(model_name="analysis", index=models.Index(fields=["user", "status"], name="aud_analysis_user_status_idx")),
    ]
