"""People and their trials (VISION D3).

Each person's trial lives in photos/trial-<person>/ with a trial.json manifest:
product, treated side, start date, length. Daily photos are named by days since the start
(day-00, day-01, ...), so a skipped day stays a gap instead of shifting later photos.
"""

import json
import re
import shutil
from datetime import date, datetime

from .analyzer import photo_files, result_dir
from .config import PHOTOS, RESULTS, key_var_for

PERSON_RE = re.compile(r"^[a-z0-9][a-z0-9-]{0,30}$")
DEFAULTS = {"product": "", "claim": "", "treated_side": "L", "start_date": None, "duration_days": 21}
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
    gate = (read_meta(day0) or {}).get("gate") if day0 else None
    return {
        **trial,
        "key_var": key_var_for(f"trial-{person}"),
        "day": day,
        "checkins": [p.stem for p in daily],
        "today_done": day is not None and f"day-{day:02d}" in {p.stem for p in daily},
        "noise_count": len(photo_files(PHOTOS / f"noise-{person}")),
        "noise_target": NOISE_TARGET,
        "day0": {
            "url": f"/files/photos/trial-{person}/{day0.name}",
            "gate_passed": gate.get("passed") if gate else None,
            "failed": [c["label"] for c in gate.get("checks", []) if not c["pass"]] if gate else [],
        } if day0 else None,
    }


def retire(set_name: str, photo) -> str:
    """Move a photo, its metadata and its cached analyses to _retired/. Nothing is deleted, and a
    retake under the same name never inherits the old photo's scores."""
    stamp = datetime.now().strftime("%Y%m%d-%H%M%S")
    dest = PHOTOS / "_retired" / set_name / stamp
    dest.mkdir(parents=True, exist_ok=True)
    moved = [photo, photo.with_suffix(".meta.json")]
    whole, split = result_dir(set_name, False), result_dir(set_name, True)
    moved += [whole / f"{photo.stem}.json"]
    moved += [split / f"{photo.stem}-{s}.json" for s in "LR"]
    moved += [split / "images" / f"{photo.stem}-{s}.jpg" for s in "LR"]
    for src in moved:
        if src.exists():
            is_result = RESULTS in src.parents
            target = dest / ("results" if is_result else "") / src.relative_to(RESULTS if is_result else PHOTOS / set_name)
            target.parent.mkdir(parents=True, exist_ok=True)
            shutil.move(str(src), str(target))
    return dest.relative_to(PHOTOS.parent).as_posix()
