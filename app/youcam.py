"""Minimal YouCam Skin Analysis client (stdlib only).

API reference: https://docs.makeupar.com/reference/ai_skin_analysis
"""

import json
import mimetypes
import os
import time
import urllib.error
import urllib.request
from pathlib import Path

from .config import DEFAULT_BASE_URL, DEFAULT_KEY_VAR, load_env

POLL_SECONDS = 2
POLL_TIMEOUT_SECONDS = 180


class YouCamError(RuntimeError):
    """The task ran but YouCam rejected the photo (e.g. error_src_face_too_small). Costs no units."""

    def __init__(self, code, message):
        super().__init__(f"{code}: {message}")
        self.code = code
        self.message = message


class YouCam:
    def __init__(self, api_key, base_url=DEFAULT_BASE_URL):
        self.api_key = api_key
        self.base_url = base_url.rstrip("/")

    @classmethod
    def from_env(cls, key_var=DEFAULT_KEY_VAR):
        load_env()
        api_key = os.environ.get(key_var)
        if not api_key:
            raise RuntimeError(f"Set {key_var} in .env (copy .env.example).")
        return cls(api_key, os.environ.get("YOUCAM_BASE_URL") or DEFAULT_BASE_URL)

    def _request(self, method, path, body=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(
            self.base_url + path,
            data=data,
            method=method,
            headers={
                "Authorization": f"Bearer {self.api_key}",
                "Content-Type": "application/json",
            },
        )
        try:
            with urllib.request.urlopen(req, timeout=60) as resp:
                return json.load(resp)
        except urllib.error.HTTPError as e:
            raise RuntimeError(f"{method} {path} -> HTTP {e.code}: {e.read().decode(errors='replace')}")

    def upload(self, photo: Path) -> str:
        content_type = mimetypes.guess_type(photo.name)[0] or "image/jpeg"
        size = photo.stat().st_size
        resp = self._request("POST", "/file", {
            "files": [{"content_type": content_type, "file_name": photo.name, "file_size": size}],
        })
        try:
            file_info = resp["data"]["files"][0]
            upload = file_info["requests"][0]
        except (KeyError, IndexError, TypeError):
            raise RuntimeError(f"Unexpected /file response shape: {json.dumps(resp)[:500]}")

        put = urllib.request.Request(
            upload["url"],
            data=photo.read_bytes(),
            method=upload.get("method", "PUT"),
            headers=upload.get("headers") or {"Content-Type": content_type},
        )
        with urllib.request.urlopen(put, timeout=120):
            pass
        return file_info["file_id"]

    def analyze(self, file_id: str, actions) -> dict:
        resp = self._request("POST", "/task/skin-analysis", {
            "src_file_id": file_id,
            "dst_actions": actions,
            "format": "json",
        })
        task_id = resp["data"]["task_id"]

        deadline = time.monotonic() + POLL_TIMEOUT_SECONDS
        while time.monotonic() < deadline:
            time.sleep(POLL_SECONDS)
            data = self._request("GET", f"/task/skin-analysis/{task_id}")["data"]
            status = data.get("task_status")
            if status == "success":
                return data
            if status == "error":
                raise YouCamError(data.get("error") or "error", data.get("error_message") or json.dumps(data)[:300])
        raise RuntimeError(f"Task {task_id} still running after {POLL_TIMEOUT_SECONDS}s")


def raw_scores(result: dict) -> dict:
    """{concern: raw_score} from a task result. ui_score is 'psychologically adjusted', so skip it."""
    return {
        o["type"]: o["raw_score"]
        for o in result["results"]["output"]
        if isinstance(o.get("raw_score"), (int, float))
    }
