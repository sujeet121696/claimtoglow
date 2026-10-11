"""Email through Resend's HTTP API (sign-in links), as kharidwise does. Stdlib only.
Without RESEND_API_KEY and EMAIL_FROM in .env nothing is sent and email sign-in isn't offered.
EMAIL_FROM must be on a domain verified with Resend (kharidwise.com)."""

import json
import os
import urllib.error
import urllib.request

from .config import load_env


def can_mail() -> bool:
    load_env()
    return bool(os.environ.get("RESEND_API_KEY") and os.environ.get("EMAIL_FROM"))


def send_mail(to: str, subject: str, text: str) -> bool:
    if not can_mail():
        return False
    body = json.dumps({"from": os.environ["EMAIL_FROM"], "to": [to], "subject": subject, "text": text}).encode()
    req = urllib.request.Request("https://api.resend.com/emails", data=body, method="POST", headers={
        "Authorization": f"Bearer {os.environ['RESEND_API_KEY']}",
        "Content-Type": "application/json",
        "User-Agent": "claim-to-glow",  # Resend sits behind Cloudflare, which may refuse Python's default agent
    })
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return 200 <= resp.status < 300
    except (urllib.error.URLError, TimeoutError):
        return False
