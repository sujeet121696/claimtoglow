"""Local API for the trial lab: save gated photos, analyse them, read scores and noise.

Run: .venv/Scripts/python -m uvicorn app.main:app --port 8000
Photos stay on this machine; the server is meant for localhost (and the Vite proxy) only.
"""

import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path

from fastapi import FastAPI, File, Form, HTTPException, UploadFile
from fastapi.staticfiles import StaticFiles

from .analyzer import analyze_cached, cached_scores, mirror_halves, photo_files, result_dir
from .config import NAME_RE, PHOTOS
from .noise import noise_rows, split_pairs
from .youcam import YouCam, YouCamError

MAX_UPLOAD_BYTES = 25 * 1024 * 1024
REFERENCE = ("trial", "day-00")  # the day-0 photo every later capture is matched against

app = FastAPI(title="Claim to Glow lab")
PHOTOS.mkdir(exist_ok=True)
_client = None


def client() -> YouCam:
    global _client
    if _client is None:
        try:
            _client = YouCam.from_env()
        except RuntimeError as e:
            raise HTTPException(500, str(e))
    return _client


def set_dir(name: str) -> Path:
    if not NAME_RE.match(name):
        raise HTTPException(400, f"Bad set name: {name!r}")
    return PHOTOS / name


def find_photo(name: str, stem: str) -> Path:
    for p in photo_files(set_dir(name)):
        if p.stem == stem:
            return p
    raise HTTPException(404, f"No photo {stem!r} in {name!r}")


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def read_meta(photo: Path):
    meta = photo.with_suffix(".meta.json")
    return json.loads(meta.read_text(encoding="utf-8")) if meta.exists() else None


def photo_info(name: str, photo: Path, whole: dict, halves: dict) -> dict:
    meta = read_meta(photo) or {}
    return {
        "stem": photo.stem,
        "file": photo.name,
        "url": f"/files/photos/{name}/{photo.name}",
        "sha256": meta.get("sha256") or sha256(photo),
        "meta": meta,
        "scores": whole.get(photo.stem),
        "split": {"L": halves[photo.stem][0], "R": halves[photo.stem][1]} if photo.stem in halves else None,
    }


def next_stem(name: str) -> str:
    prefix = "day" if name == "trial" else "shot"
    taken = {p.stem for p in photo_files(set_dir(name))}
    n = 0
    while f"{prefix}-{n:02d}" in taken:
        n += 1
    return f"{prefix}-{n:02d}"


@app.get("/api/sets")
def list_sets():
    sets = [{"name": d.name, "count": len(photo_files(d))}
            for d in sorted(PHOTOS.iterdir()) if d.is_dir() and NAME_RE.match(d.name)]
    return {"sets": sets}


@app.get("/api/sets/{name}")
def get_set(name: str):
    whole = cached_scores(result_dir(name, False))
    halves = split_pairs(cached_scores(result_dir(name, True)))
    return {"name": name, "photos": [photo_info(name, p, whole, halves) for p in photo_files(set_dir(name))]}


@app.post("/api/sets/{name}/photos")
async def upload_photo(name: str, file: UploadFile = File(...), stem: str = Form(""), meta: str = Form("")):
    folder = set_dir(name)
    ext = Path(file.filename or "").suffix.lower()
    if ext not in {".jpg", ".jpeg", ".png"}:
        ext = ".png" if file.content_type == "image/png" else ".jpg"
    stem = stem.strip() or next_stem(name)
    if not NAME_RE.match(stem) or not re.match(r"^[^.]+$", stem):
        raise HTTPException(400, f"Bad photo name: {stem!r}")
    if any(p.stem == stem for p in photo_files(folder)):
        raise HTTPException(409, f"{name}/{stem} already exists. Photos are never overwritten.")

    data = await file.read()
    if not data or len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(400, "Empty or too large file")
    folder.mkdir(parents=True, exist_ok=True)
    photo = folder / f"{stem}{ext}"
    photo.write_bytes(data)

    record = json.loads(meta) if meta else {}
    record.update({
        "sha256": hashlib.sha256(data).hexdigest(),
        "saved_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "original_name": file.filename,
    })
    photo.with_suffix(".meta.json").write_text(json.dumps(record, indent=2), encoding="utf-8")
    return photo_info(name, photo, {}, {})


@app.post("/api/sets/{name}/photos/{stem}/analyze")
def analyze_photo(name: str, stem: str, split: bool = False):
    """Whole-face or split-face analysis. Cached results are returned without calling YouCam."""
    photo = find_photo(name, stem)
    out_dir = result_dir(name, split)
    targets = mirror_halves(photo, out_dir / "images") if split else [photo]
    try:
        for target in targets:
            analyze_cached(client(), target, out_dir)
    except YouCamError as e:
        raise HTTPException(422, {"code": e.code, "message": e.message})
    except RuntimeError as e:
        raise HTTPException(502, str(e))
    return get_set(name)


@app.get("/api/sets/{name}/noise")
def noise(name: str, split: bool = False):
    set_dir(name)
    return {"rows": noise_rows(cached_scores(result_dir(name, split)), split)}


@app.get("/api/reference")
def reference():
    """The day-0 trial photo and its capture metrics, used for the ghost overlay and matching."""
    name, stem = REFERENCE
    for p in photo_files(PHOTOS / name):
        if p.stem == stem:
            return {"url": f"/files/photos/{name}/{p.name}", "meta": read_meta(p)}
    return None


app.mount("/files/photos", StaticFiles(directory=PHOTOS), name="photos")
