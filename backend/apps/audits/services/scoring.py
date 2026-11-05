"""Transparent, rule-based scoring. Severity deductions are visible in findings."""
SEVERITY_POINTS = {"critical": 20, "high": 12, "medium": 6, "low": 3}
CATEGORIES = ("visual_design", "user_experience", "responsiveness", "performance", "accessibility", "content_structure")

CATEGORY_METHODS = {
    "visual_design": "Rule-based deductions from measured typography and color-token consistency signals.",
    "user_experience": "Rule-based deductions from measured navigation and control-label signals.",
    "responsiveness": "Rule-based deductions from mobile viewport and horizontal-overflow measurements.",
    "performance": "Google Lighthouse Performance category score (0–100). Unavailable when Lighthouse cannot run.",
    "accessibility": "Rule-based deductions from detected DOM accessibility failures; this is not a full WCAG conformance audit.",
    "content_structure": "Rule-based deductions from measured headings, landmarks, title, and metadata.",
}

def calculate_scores(findings, lighthouse_performance=None):
    scores = {}
    for category in CATEGORIES:
        if category == "performance":
            score = round(lighthouse_performance) if isinstance(lighthouse_performance, (int, float)) else None
        else:
            deductions = sum(SEVERITY_POINTS.get(f.get("severity", "low"), 3) for f in findings if f.get("category") == category and f.get("source", "measurement") == "measurement")
            score = max(0, 100 - deductions)
        scores[category] = {"score": score, "method": CATEGORY_METHODS[category], "source": "lighthouse" if category == "performance" else "measurement"}
    available = [v["score"] for v in scores.values() if isinstance(v["score"], (int, float))]
    overall = round(sum(available) / len(available)) if available else None
    return overall, scores
