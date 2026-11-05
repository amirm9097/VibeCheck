import base64
import hashlib
import json
import logging
import urllib.request
from cryptography.fernet import Fernet, InvalidToken
from django.conf import settings
from ..models import AIProviderConfig

logger = logging.getLogger(__name__)

def _fernet():
    key = base64.urlsafe_b64encode(hashlib.sha256(settings.SECRET_KEY.encode("utf-8")).digest())
    return Fernet(key)

def encrypt_secret(value: str) -> str:
    return _fernet().encrypt(value.encode("utf-8")).decode("ascii") if value else ""

def decrypt_secret(value: str) -> str:
    if not value:
        return ""
    try:
        return _fernet().decrypt(value.encode("ascii")).decode("utf-8")
    except (InvalidToken, ValueError):
        logger.error("AI provider key could not be decrypted; check whether DJANGO_SECRET_KEY changed.")
        return ""

def request_ai_review(payload: dict, screenshot: bytes | None = None) -> tuple[dict | None, str]:
    config = AIProviderConfig.get_solo()
    api_key = decrypt_secret(config.encrypted_api_key)
    if not config.enabled or not api_key:
        return None, "not_configured"
    endpoint = config.base_url.rstrip("/")
    if not endpoint.endswith("/chat/completions"):
        endpoint += "/chat/completions" if endpoint.endswith("/v1") else "/v1/chat/completions"
    prompt = (
        "You are a rigorous website design auditor. Analyze only the supplied measurable page facts and screenshot. "
        "Do not invent behavior or claim a WCAG audit. Return strict JSON with keys: summary (max 90 words), "
        "positives (array of max 4 short strings), recommendations (array of max 6 objects with priority high|medium|low, "
        "title, rationale, action), and findings (array of max 5 objects with category visual_design|user_experience|responsiveness|accessibility|content_structure, "
        "severity high|medium|low, title, description, evidence, recommendation). All AI-generated findings must be treated as design judgments, not measured facts."
    )
    content = [{"type": "text", "text": prompt + "\nMEASURED PAGE DATA:\n" + json.dumps(payload, ensure_ascii=False)[:14000]}]
    if screenshot:
        image_data = base64.b64encode(screenshot).decode("ascii")
        content.append({"type": "image_url", "image_url": {"url": "data:image/png;base64," + image_data, "detail": "high"}})
    body = json.dumps({"model": config.model, "temperature": 0.2, "response_format": {"type": "json_object"}, "messages": [{"role": "user", "content": content}]}).encode("utf-8")
    req = urllib.request.Request(endpoint, data=body, headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}, method="POST")
    try:
        with urllib.request.urlopen(req, timeout=35) as response:
            data = json.loads(response.read(2_000_000))
        message = data["choices"][0]["message"]["content"]
        result = json.loads(message)
        if not isinstance(result, dict):
            raise ValueError("AI response was not an object")
        return result, "completed"
    except Exception:
        logger.exception("AI review request failed")
        return None, "unavailable"
