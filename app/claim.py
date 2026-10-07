"""Claim agent: turns a product's marketing claim into what the skin analysis can measure.

The model only suggests; the output is checked against the concern list here, and a person
confirms it in Person → Edit before the verdict uses it.
"""

from .analyzer import DEFAULT_ACTIONS
from .llm import complete_json

CONCERN_MEANINGS = {
    "acne": "pimples, breakouts",
    "age_spot": "dark spots, pigmentation, uneven spots",
    "redness": "redness, irritation",
    "radiance": "glow, brightness, dullness",
    "texture": "smoothness, roughness",
    "pore": "visible pores",
    "wrinkle": "wrinkles, fine lines",
    "moisture": "hydration, dryness",
    "oiliness": "oil, shine",
    "dark_circle_v2": "dark circles under the eyes",
}
assert set(CONCERN_MEANINGS) == set(DEFAULT_ACTIONS)

SYSTEM = (
    "You turn a skincare product's marketing claim into what a skin-analysis camera can measure.\n"
    "Allowed concern ids (id: meaning):\n"
    + "\n".join(f"- {c}: {m}" for c, m in CONCERN_MEANINGS.items())
    + "\n\nReply with one JSON object only:\n"
    '{"concerns": [ids the claim promises to improve], "deadline_days": number or null, "rationale": "one short sentence"}\n'
    "Rules: use only the allowed ids; pick only what the claim itself promises, [] if nothing fits. "
    "deadline_days is the time the claim states (\"4 weeks\" is 28), null if it states none."
)


def clean(reply: dict) -> dict:
    concerns = [c for c in dict.fromkeys(reply.get("concerns") or []) if c in CONCERN_MEANINGS]
    days = reply.get("deadline_days")
    days = int(days) if isinstance(days, (int, float)) and 1 <= days <= 365 else None
    return {"concerns": concerns, "deadline_days": days, "rationale": str(reply.get("rationale") or "")[:300]}


def parse_claim(claim: str, product: str = "", complete=complete_json) -> dict:
    user = f"Product: {product or 'unknown'}\nClaim: {claim}"
    reply, model = complete(SYSTEM, user)
    return {**clean(reply), "model": model}
