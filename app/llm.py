"""Thin multi-provider LLM layer (stdlib only): tries each provider that has a key, in order, and
falls back to the next one on any error. Every call asks for one JSON object.

.env: GROQ_API_KEY, GEMINI_API_KEY, NVIDIA_API_KEY, ANTHROPIC_API_KEY (any subset).
Optional: LLM_PROVIDERS=groq,gemini to change the order, <PROVIDER>_MODEL to change a model.
"""

import json
import os
import urllib.error
import urllib.request

from .config import load_env

DEFAULT_ORDER = ["groq", "gemini", "nvidia", "anthropic"]
DEFAULT_MODELS = {  # free tiers; models retire, so each can be overridden with <PROVIDER>_MODEL
    "groq": "openai/gpt-oss-120b",
    "gemini": "gemini-3.5-flash-lite",
    "nvidia": "nvidia/nemotron-3-super-120b-a12b",
    "anthropic": "claude-haiku-4-5-20251001",
}
OPENAI_COMPATIBLE = {
    "groq": "https://api.groq.com/openai/v1/chat/completions",
    "nvidia": "https://integrate.api.nvidia.com/v1/chat/completions",
}
TIMEOUT_SECONDS = 60


class LLMError(RuntimeError):
    pass


def _post(url: str, headers: dict, body: dict) -> dict:
    req = urllib.request.Request(url, data=json.dumps(body).encode(), method="POST",
                                 # a named User-Agent: Groq's Cloudflare blocks Python's default (error 1010)
                                 headers={"Content-Type": "application/json", "User-Agent": "claimtoglow/0.1", **headers})
    try:
        with urllib.request.urlopen(req, timeout=TIMEOUT_SECONDS) as resp:
            return json.load(resp)
    except urllib.error.HTTPError as e:
        raise LLMError(f"HTTP {e.code}: {e.read().decode(errors='replace')[:300]}")


def _openai_compatible(provider: str, key: str, model: str, system: str, user: str) -> str:
    body = {"model": model, "temperature": 0,
            "messages": [{"role": "system", "content": system}, {"role": "user", "content": user}]}
    data = _post(OPENAI_COMPATIBLE[provider], {"Authorization": f"Bearer {key}"}, body)
    return data["choices"][0]["message"]["content"]


def _gemini(key: str, model: str, system: str, user: str) -> str:
    body = {"systemInstruction": {"parts": [{"text": system}]},
            "contents": [{"role": "user", "parts": [{"text": user}]}],
            "generationConfig": {"temperature": 0, "responseMimeType": "application/json"}}
    data = _post(f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
                 {"x-goog-api-key": key}, body)
    parts = data["candidates"][0]["content"]["parts"]
    return "".join(p.get("text", "") for p in parts if not p.get("thought"))


def _anthropic(key: str, model: str, system: str, user: str) -> str:
    body = {"model": model, "max_tokens": 1024, "temperature": 0, "system": system,
            "messages": [{"role": "user", "content": user}]}
    data = _post("https://api.anthropic.com/v1/messages",
                 {"x-api-key": key, "anthropic-version": "2023-06-01"}, body)
    return "".join(b.get("text", "") for b in data["content"] if b.get("type") == "text")


def _call(provider: str, key: str, model: str, system: str, user: str) -> str:
    if provider in OPENAI_COMPATIBLE:
        return _openai_compatible(provider, key, model, system, user)
    if provider == "gemini":
        return _gemini(key, model, system, user)
    return _anthropic(key, model, system, user)


def parse_json(text: str) -> dict:
    """The first {...} in a reply (models sometimes wrap JSON in prose or code fences)."""
    start, end = text.find("{"), text.rfind("}")
    if start < 0 or end < start:
        raise LLMError("Reply had no JSON object")
    return json.loads(text[start:end + 1])


def providers() -> list:
    """(provider, key, model) for each provider with a key, in the configured order."""
    load_env()
    order = [p.strip() for p in os.environ.get("LLM_PROVIDERS", ",".join(DEFAULT_ORDER)).split(",") if p.strip()]
    out = []
    for p in order:
        if p in DEFAULT_MODELS and os.environ.get(f"{p.upper()}_API_KEY"):
            out.append((p, os.environ[f"{p.upper()}_API_KEY"], os.environ.get(f"{p.upper()}_MODEL") or DEFAULT_MODELS[p]))
    return out


def complete_json(system: str, user: str, call=_call) -> tuple:
    """(reply as dict, "provider/model"). Raises LLMError when no provider is set or all fail."""
    available = providers()
    if not available:
        raise LLMError("No AI provider set. Add GROQ_API_KEY, GEMINI_API_KEY or NVIDIA_API_KEY to .env.")
    errors = []
    for provider, key, model in available:
        try:
            return parse_json(call(provider, key, model, system, user)), f"{provider}/{model}"
        except Exception as e:  # any failure (network, quota, bad JSON) moves on to the next provider
            errors.append(f"{provider}: {e}")
    raise LLMError("All AI providers failed. " + " | ".join(errors))
