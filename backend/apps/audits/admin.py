from django.contrib import admin
from .models import Analysis, SavedWebsite, Comparison, AIProviderConfig, UsagePolicy

@admin.register(Analysis)
class AnalysisAdmin(admin.ModelAdmin):
    list_display = ("domain", "user", "status", "overall_score", "created_at")
    list_filter = ("status", "created_at", "is_favorite")
    search_fields = ("domain", "url", "user__email")
    readonly_fields = ("id", "created_at", "updated_at", "started_at", "completed_at")

@admin.register(SavedWebsite)
class SavedWebsiteAdmin(admin.ModelAdmin):
    list_display = ("domain", "user", "created_at")
    search_fields = ("domain", "user__email")

@admin.register(Comparison)
class ComparisonAdmin(admin.ModelAdmin):
    list_display = ("name", "user", "created_at")
    filter_horizontal = ("analyses",)

@admin.register(AIProviderConfig)
class AIProviderConfigAdmin(admin.ModelAdmin):
    list_display = ("provider", "model", "enabled", "updated_at")
    exclude = ("encrypted_api_key",)

@admin.register(UsagePolicy)
class UsagePolicyAdmin(admin.ModelAdmin):
    list_display = ("daily_analysis_limit", "max_comparison_sites", "allow_public_shares", "updated_at")
