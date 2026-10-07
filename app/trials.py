"""People and their trials (VISION D3).

Each person's trial lives in photos/trial-<person>/ with a trial.json manifest:
product, treated side, start date, length. Daily photos are named by days since the start
(day-00, day-01, ...), so a skipped day stays a gap instead of shifting later photos.
"""

import json
import re
import shutil
from datetime import date, datetime

from .analyzer import cached_scores, photo_files, result_dir
from .config import PHOTOS, RESULTS, key_var_for
from .noise import split_pairs
from .verdict import verdict

PERSON_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,30}$")
DEFAULTS = {"product": "", "claim": "", "concerns": [], "notes": "", "treated_side": "L", "start_date": None, "duration_days": 21}
NOISE_TARGET = 5


def manifest_path(person: str):
    return PHOTOS / f"trial-{person}" / "trial.json"


def read_trial(person: str) -> dict:
    path = manifest_path(person)
    data = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    return {**DEFAULTS, **data, "person": person}


def write_trial(person: str, fields: dict) -> dict:
    trial = {**read_trial(person), **fields, "person": person}
    path = manifest_path(person)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(trial, indent=2), encoding="utf-8")
    return trial


def people() -> list:
    names = (d.name[len("trial-"):] for d in PHOTOS.glob("trial-*")
             if d.is_dir() and PERSON_RE.match(d.name[len("trial-"):]))
    return sorted(names)


def day_of(trial: dict, on: date | None = None):
    if not trial.get("start_date"):
        return None
    return ((on or date.today()) - date.fromisoformat(trial["start_date"])).days


def summary(person: str, read_meta) -> dict:
    """Everything the Today screen needs for one person."""
    trial = read_trial(person)
    daily = photo_files(PHOTOS / f"trial-{person}")
    day0 = next((p for p in daily if p.stem == "day-00"), None)
    day = day_of(trial)
    day0_meta = (read_meta(day0) or {}) if day0 else {}
    gate = day0_meta.get("gate")
    return {
        **trial,
        "key_var": key_var_for(f"trial-{person}"),
        "day": day,
        "checkins": [p.stem for p in daily],
        "today_done": day is not None and f"day-{day:02d}" in {p.stem for p in daily},
        "noise_count": len(photo_files(PHOTOS / f"noise-{person}")),
        "noise_target": NOISE_TARGET,
        "verdict": {k: v for k, v in trial_verdict(person).items() if k in ("status", "reason")},
        "day0": {
            "url": f"/files/photos/trial-{person}/{day0.name}",
            "saved_at": day0_meta.get("saved_at"),  # same time of day = same light
            "gate_passed": gate.get("passed") if gate else None,
            "failed": [c["label"] for c in gate.get("checks", []) if not c["pass"]] if gate else [],
        } if day0 else None,
    }


def _results_of(set_name: str, stem: str) -> list:
    whole, split = result_dir(set_name, False), result_dir(set_name, True)
    return ([whole / f"{stem}.json"]
            + [split / f"{stem}-{s}.json" for s in "LR"]
            + [split / "images" / f"{stem}-{s}.jpg" for s in "LR"])


def _move_aside(set_name: str, files: list):
    """Move the files that exist to photos/_retired/<set>/<stamp>/ (results under results/).
    Nothing is deleted. Returns the folder, or None when there was nothing to move."""
    files = [f for f in files if f.exists()]
    if not files:
        return None
    dest = PHOTOS / "_retired" / set_name / datetime.now().strftime("%Y%m%d-%H%M%S")
    for src in files:
        is_result = RESULTS in src.parents
        target = dest / ("results" if is_result else "") / src.relative_to(RESULTS if is_result else PHOTOS / set_name)
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.move(str(src), str(target))
    return dest.relative_to(PHOTOS.parent).as_posix()


def retire(set_name: str, photo) -> str:
    """Move a photo, its metadata and its cached analyses to _retired/. A retake under the same
    name never inherits the old photo's scores."""
    return _move_aside(set_name, [photo, photo.with_suffix(".meta.json"), *_results_of(set_name, photo.stem)])


def retire_stale_results(set_name: str, stem: str):
    """Before a new photo is saved as <stem>: any scores cached under that name belong to an older
    photo (one removed outside the lab), so move them aside instead of letting the new one inherit them."""
    return _move_aside(set_name, _results_of(set_name, stem))


def treated_minus_control(set_name: str, treated_side: str) -> dict:
    """{stem: {concern: T - C}} for every photo of a set with both halves analysed."""
    pairs = split_pairs(cached_scores(result_dir(set_name, True)))
    out = {}
    for stem, (left, right) in pairs.items():
        treated, control = (left, right) if treated_side == "L" else (right, left)
        out[stem] = {c: treated[c] - control[c] for c in treated if c in control}
    return out


def trial_verdict(person: str) -> dict:
    """Baseline = day-00 + the repeat photos; checkpoint = the latest analysed day after day 0."""
    trial = read_trial(person)
    daily = treated_minus_control(f"trial-{person}", trial["treated_side"])
    repeats = treated_minus_control(f"noise-{person}", trial["treated_side"])
    days = sorted(int(s[4:]) for s in daily if re.fullmatch(r"day-\d{2}", s) and s != "day-00")
    day = days[-1] if days else None
    baseline = ([daily["day-00"]] if "day-00" in daily else []) + list(repeats.values())
    checkpoint = [daily[f"day-{day:02d}"]] if day is not None else []
    result = verdict(trial["concerns"], baseline, checkpoint, list(repeats.values()),
                     final=day is not None and day >= trial["duration_days"])
    return {**result, "person": person, "checkpoint_day": day, "duration_days": trial["duration_days"]}
