"""Paths and settings shared by the API server and the scripts."""

import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PHOTOS = ROOT / "photos"
RESULTS = ROOT / "results"
WEB_DIST = ROOT / "web" / "dist"  # built web app (npm run build), served by the API when present
DEFAULT_BASE_URL = "https://yce-api-01.makeupar.com/s2s/v2.0"

# Set and photo names become folder and file names, so keep them boring.
NAME_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,60}$", re.IGNORECASE)

# One trial per person: trial-<person> holds daily photos, noise-<person> the repeat photos.
PERSON_SET = re.compile(r"^(trial|noise|test)-(.+)$")
DEFAULT_KEY_VAR = "YOUCAM_API_KEY"


def person_of(set_name: str):
    m = PERSON_SET.match(set_name)
    return m.group(2) if m else None


def key_var_for(set_name: str) -> str:
    """Which env var pays for a set: a teammate's own key (YOUCAM_API_SAHNI_KEY for trial-sahni,
    noise-sahni and test-sahni) when it is set, otherwise the main key. Redeem codes are per registrant, so each
    teammate's units are spent only on their own trial."""
    load_env()
    person = person_of(set_name)
    if person:
        var = f"YOUCAM_API_{re.sub(r'[^A-Z0-9]', '_', person.upper())}_KEY"
        if os.environ.get(var):
            return var
    return DEFAULT_KEY_VAR


LAB_TOKEN_FILE = ROOT / ".lab_token"


def lab_token() -> str:
    """Secret that unlocks the lab for devices other than this PC (the phone over Wi-Fi).
    LAB_TOKEN in .env wins; otherwise one is generated once into .lab_token (git-ignored)."""
    load_env()
    if os.environ.get("LAB_TOKEN"):
        return os.environ["LAB_TOKEN"]
    if not LAB_TOKEN_FILE.exists():
        import secrets
        LAB_TOKEN_FILE.write_text(secrets.token_urlsafe(16), encoding="utf-8")
    return LAB_TOKEN_FILE.read_text(encoding="utf-8").strip()


def public_url() -> str | None:
    """PUBLIC_URL in .env (e.g. https://claimtoglow.kharidwise.com) when the lab is reachable
    through a Cloudflare Tunnel; None when it is used on this PC and Wi-Fi only."""
    load_env()
    return os.environ.get("PUBLIC_URL", "").rstrip("/") or None


def load_env():
    """Read KEY=VALUE lines from .env into os.environ (without overriding real env vars)."""
    env_file = ROOT / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if line and not line.startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())
