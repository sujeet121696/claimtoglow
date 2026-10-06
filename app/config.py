"""Paths and settings shared by the API server and the scripts."""

import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PHOTOS = ROOT / "photos"
RESULTS = ROOT / "results"
DEFAULT_BASE_URL = "https://yce-api-01.makeupar.com/s2s/v2.0"

# Set and photo names become folder and file names, so keep them boring.
NAME_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{0,60}$", re.IGNORECASE)


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
