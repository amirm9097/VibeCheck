from django.test import SimpleTestCase
from apps.audits.services.analyzer import _normalize_ai_result


class AIOutputNormalizationTests(SimpleTestCase):
    def test_malformed_provider_values_are_dropped_or_normalized(self):
        result = _normalize_ai_result({
            "summary": "A short review",
            "findings": [
                {"title": "Broken category", "category": [], "severity": "high"},
                {"title": "Valid judgment", "category": "visual_design", "severity": "medium"},
            ],
            "recommendations": [
                {"title": "Fix hierarchy", "priority": ["critical"], "action": "Use clearer sections."},
            ],
            "positives": ["Clear purpose", 42],
        })
        self.assertEqual(len(result["findings"]), 1)
        self.assertEqual(result["findings"][0]["title"], "Valid judgment")
        self.assertEqual(result["recommendations"][0]["priority"], "medium")
        self.assertEqual(result["positives"], ["Clear purpose"])

    def test_non_object_provider_output_is_ignored(self):
        self.assertIsNone(_normalize_ai_result(["not", "an", "object"]))
