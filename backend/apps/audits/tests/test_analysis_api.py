from unittest.mock import patch
from django.test import TestCase
from rest_framework.test import APIClient
from apps.accounts.models import User
from apps.audits.models import Analysis, UsagePolicy

class AnalysisCreationTests(TestCase):
    def setUp(self):
        self.user = User.objects.create_user("auditor@example.com", "long-password-123456")
        self.client = APIClient(); self.client.force_authenticate(self.user)
    @patch("apps.audits.views.analyze_website.delay")
    @patch("apps.audits.serializers.validate_public_url", return_value="https://example.com/")
    def test_analysis_is_persisted_and_enqueued(self, _guard, enqueue):
        enqueue.return_value.id = "task-123"
        response = self.client.post("/api/v1/analyses/", {"url": "https://example.com"}, format="json")
        self.assertEqual(response.status_code, 201)
        record = Analysis.objects.get(pk=response.data["id"])
        self.assertEqual(record.status, Analysis.Status.QUEUED)
        self.assertEqual(record.task_id, "task-123")
        enqueue.assert_called_once()

    @patch("apps.audits.views.analyze_website.delay")
    @patch("apps.audits.serializers.validate_public_url", return_value="https://example.com/")
    def test_daily_usage_limit_is_enforced_before_queueing(self, _guard, enqueue):
        UsagePolicy.objects.create(pk=1, daily_analysis_limit=1)
        Analysis.objects.create(user=self.user, url="https://prior.example/", normalized_url="https://prior.example/", domain="prior.example")
        response = self.client.post("/api/v1/analyses/", {"url": "https://example.com"}, format="json")
        self.assertEqual(response.status_code, 400)
        self.assertIn("limit", response.data)
        enqueue.assert_not_called()
