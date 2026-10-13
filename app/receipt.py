"""Timeline and receipt for one trial (TASKS 21, 22).

timeline: every daily photo in day order with its capture-gate result and treated − control
scores, plus the baseline and the noise band one photo can't escape.
receipt: the public, face-free record of a trial: claim, verdict, and the SHA-256 fingerprint of
every photo it rests on. receipt_hash fingerprints the receipt itself, so any later edit shows.
"""

import hashlib
import json
import statistics
from datetime import datetime, timezone

from .analyzer import photo_files
from .config import PHOTOS
from .masking import MASK_DIR, blanked_path
from .trials import (DAY_STEM, by_day, day_means, failed_checks, is_checkpoint, read_meta, read_trial,
                     treated_minus_control, trial_verdict)
from .verdict import MIN_DAYS, MIN_NOISE_PHOTOS, between_sd, floor_of, values


def _sha256(path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def _photos(set_name: str) -> list:
    """Each photo's fingerprint record: name, time, SHA-256 and whether it still matches capture."""
    out = []
    for p in photo_files(PHOTOS / set_name):
        meta = read_meta(p) or {}
        actual = _sha256(p)
        gate = meta.get("gate")
        out.append({
            "stem": p.stem,
            "saved_at": meta.get("saved_at"),
            "sha256": actual,
            "tampered": bool(meta.get("sha256")) and meta["sha256"] != actual,
            "gate_passed": gate.get("passed") if gate else None,
            "failed": failed_checks(gate),
        })
    return out


def timeline(person: str) -> dict:
    trial = read_trial(person)
    daily = treated_minus_control(f"trial-{person}", trial["treated_side"])
    repeats = list(treated_minus_control(f"noise-{person}", trial["treated_side"]).values())
    baseline = ([daily["day-00"]] if "day-00" in daily else []) + repeats
    concerns = trial["concerns"]

    def mean_of(series, c):
        vals = [s[c] for s in series if c in s]
        return round(statistics.mean(vals), 2) if vals else None

    days = day_means(by_day(daily))

    def sd_of(c):
        vals = values(repeats, c)
        return round(statistics.stdev(vals), 2) if len(vals) >= 2 else None

    def band_of(c):
        """Noise for one photo against the baseline: the verdict's floor with k = 1."""
        rep, day, k0 = values(repeats, c), values(days, c), len(values(baseline, c))
        if len(rep) < MIN_NOISE_PHOTOS or len(day) < MIN_DAYS or not k0:
            return None
        sd = statistics.stdev(rep)
        return round(floor_of(sd, between_sd(sd, day), 1, k0), 2)

    entries = []
    for photo in _photos(f"trial-{person}"):
        m = DAY_STEM.match(photo["stem"])
        day = int(m.group(1)) if m else None
        blanked = blanked_path(f"trial-{person}", photo["stem"])
        entries.append({
            **photo,
            "day": day,
            "checkpoint": day is not None and is_checkpoint(trial, day),
            "masked_url": f"/files/photos/trial-{person}/{MASK_DIR}/{blanked.name}" if blanked else None,
            "tc": daily.get(photo["stem"]),  # {concern: treated − control}, None when not analysed
        })
    return {
        "person": person,
        "start_date": trial["start_date"],
        "duration_days": trial["duration_days"],
        "concerns": concerns,
        "baseline": {c: mean_of(baseline, c) for c in concerns},
        "k0": len(baseline),
        "sd": {c: sd_of(c) for c in concerns},
        "band": {c: band_of(c) for c in concerns},
        "entries": entries,
        "verdict": trial_verdict(person),
    }


def receipt_hash(body: dict) -> str:
    """SHA-256 of the receipt in canonical JSON (sorted keys, no spaces)."""
    canonical = json.dumps(body, sort_keys=True, separators=(",", ":"), ensure_ascii=False)
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()


def receipt(person: str, now: datetime | None = None) -> dict:
    """No faces, no notes: only what a stranger needs to check the result."""
    trial = read_trial(person)
    v = trial_verdict(person)
    body = {
        "person": person,
        "product": trial["product"],
        "claim": trial["claim"],
        "concerns": trial["concerns"],
        "treated_side": trial["treated_side"],
        "start_date": trial["start_date"],
        "duration_days": trial["duration_days"],
        "verdict": {k: v[k] for k in ("status", "reason", "concerns", "checkpoint_day")},
        "method": "YouCam Skin Analysis raw_score on mirrored half-faces; change = treated − control "
                  "vs baseline; counts only beyond 2·√(SDw²·(1/k + 1/k0) + 2·SDb²), SDw from repeat photos "
                  "in one sitting, SDb the extra noise between days from successive daily photos.",
        "photos": {"daily": _photos(f"trial-{person}"), "repeat": _photos(f"noise-{person}")},
    }
    # The time is outside the hash, so the same trial data always gives the same fingerprint.
    generated_at = (now or datetime.now(timezone.utc)).isoformat(timespec="seconds")
    return {**body, "receipt_hash": receipt_hash(body), "generated_at": generated_at}


BADGE_TONE = {"met": "#007a36", "not met": "#c62828", "not enough evidence": "#5c6b80"}
BADGE_TEXT = {"met": "claim met", "not met": "claim not met", "not enough evidence": "not enough evidence"}


def badge_svg(status: str) -> str:
    """The embeddable "Claim to Glow" badge. Width is estimated from the text (~7 px a character)."""
    left, right = "Claim to Glow", BADGE_TEXT.get(status, status)
    lw, rw = 14 + 7 * len(left), 14 + 7 * len(right)
    tone = BADGE_TONE.get(status, "#5c6b80")
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" width="{lw + rw}" height="22" role="img" '
        f'aria-label="{left}: {right}"><title>{left}: {right}</title>'
        f'<rect width="{lw}" height="22" rx="4" fill="#0a2540"/>'
        f'<rect x="{lw}" width="{rw}" height="22" rx="4" fill="{tone}"/>'
        f'<rect x="{lw - 4}" width="8" height="22" fill="{tone}"/>'
        f'<g fill="#fff" font-family="Segoe UI,Helvetica,Arial,sans-serif" font-size="12" text-anchor="middle">'
        f'<text x="{lw / 2}" y="15">{left}</text><text x="{lw + rw / 2}" y="15">{right}</text></g></svg>'
    )
