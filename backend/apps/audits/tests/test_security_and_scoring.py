from unittest.mock import patch
import ipaddress
from django.core.exceptions import ValidationError
from django.test import SimpleTestCase, TestCase
from rest_framework.test import APIClient
from apps.accounts.models import User
from apps.audits.models import Analysis
from apps.audits.services.url_guard import validate_public_url
from apps.audits.services.scoring import calculate_scores

class URLGuardTests(SimpleTestCase):
    def test_adds_https_for_hostname(self):
        with patch("apps.audits.services.url_guard.public_addresses", return_value=[ipaddress.ip_address("93.184.216.34")]):
            self.assertEqual(validate_public_url("example.com"), "https://example.com/")
    def test_blocks_loopback_and_internal_ports(self):
        for url in ("http://127.0.0.1", "http://localhost", "http://10.0.0.1", "https://example.com:8443", "https://example.com:0", "https://example.com:80", "http://example.com:443"):
            with self.subTest(url=url), self.assertRaises(ValidationError):
                validate_public_url(url)
    def test_literal_public_ip_is_allowed_without_dns(self):
        self.assertEqual(validate_public_url("https://93.184.216.34", resolve=False), "https://93.184.216.34/")
    def test_private_literal_is_rejected_without_dns(self):
        with self.assertRaises(ValidationError):
            validate_public_url("https://192.168.1.4", resolve=False)
    def test_rejects_mixed_public_and_private_dns_answers(self):
        with patch("apps.audits.services.url_guard.socket.getaddrinfo", return_value=[
            (None, None, None, None, ("93.184.216.34", 443)),
            (None, None, None, None, ("10.0.0.4", 443)),
        ]):
            with self.assertRaises(ValidationError):
                validate_public_url("mixed.example")
    def test_blocks_credentials_and_non_http_schemes(self):
        for url in ("https://user:pass@example.com", "file:///etc/passwd", "ftp://example.com"):
            with self.subTest(url=url), self.assertRaises(ValidationError):
                validate_public_url(url)

class ScoringTests(SimpleTestCase):
    def test_scores_are_auditable_deductions(self):
        findings = [
            {"category": "accessibility", "severity": "high", "source": "measurement"},
            {"category": "accessibility", "severity": "low", "source": "measurement"},
            {"category": "visual_design", "severity": "critical", "source": "ai_judgment"},
        ]
        overall, scores = calculate_scores(findings, 82)
        self.assertEqual(scores["accessibility"]["score"], 85)
        self.assertEqual(scores["visual_design"]["score"], 100)  # AI judgment never changes measured score.
        self.assertEqual(scores["performance"]["score"], 82)
        self.assertIsNotNone(overall)
    def test_missing_lighthouse_is_unavailable_not_zero(self):
        _, scores = calculate_scores([], None)
        self.assertIsNone(scores["performance"]["score"])

class OwnershipTests(TestCase):
    def setUp(self):
        self.owner = User.objects.create_user("owner@example.com", "long-password-123456")
        self.other = User.objects.create_user("other@example.com", "long-password-123456")
        self.analysis = Analysis.objects.create(user=self.owner, url="https://example.com/", normalized_url="https://example.com/", domain="example.com")
    def test_analysis_history_is_user_scoped(self):
        client = APIClient(); client.force_authenticate(self.other)
        response = client.get("/api/v1/analyses/")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.data["count"], 0)
    def test_private_analysis_cannot_be_read_by_another_user(self):
        client = APIClient(); client.force_authenticate(self.other)
        response = client.get(f"/api/v1/analyses/{self.analysis.id}/")
        self.assertEqual(response.status_code, 404)
