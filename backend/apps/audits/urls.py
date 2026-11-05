from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (AnalysisViewSet, SavedWebsiteViewSet, ComparisonView, ComparisonDetailView,
                    PublicSharedReportView, PublicSharedScreenshotView, AdminOverviewView, AdminAnalysesView, AdminUsersView,
                    AdminRetryAnalysisView, AdminSettingsView)
router = DefaultRouter()
router.register("analyses", AnalysisViewSet, basename="analysis")
router.register("saved-websites", SavedWebsiteViewSet, basename="saved-website")
urlpatterns = [
    path("", include(router.urls)),
    path("comparisons/", ComparisonView.as_view(), name="comparisons"),
    path("comparisons/<uuid:pk>/", ComparisonDetailView.as_view(), name="comparison-detail"),
    path("shared/<uuid:token>/", PublicSharedReportView.as_view(), name="shared-report"),
    path("shared/<uuid:token>/screenshot/<str:kind>/", PublicSharedScreenshotView.as_view(), name="shared-screenshot"),
    path("admin/overview/", AdminOverviewView.as_view(), name="admin-overview"),
    path("admin/analyses/", AdminAnalysesView.as_view(), name="admin-analyses"),
    path("admin/analyses/<uuid:pk>/retry/", AdminRetryAnalysisView.as_view(), name="admin-retry-analysis"),
    path("admin/users/", AdminUsersView.as_view(), name="admin-users"),
    path("admin/users/<int:pk>/", AdminUsersView.as_view(), name="admin-user-detail"),
    path("admin/settings/", AdminSettingsView.as_view(), name="admin-settings"),
]
