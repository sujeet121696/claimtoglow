"""Analyse photos with YouCam, caching every result on disk.

Layout (shared with scripts/noise_test.py):
    photos/<set>/<stem>.jpg                 original photo
    results/<set>/<stem>.json               whole-face result
    results/<set>-split/images/<stem>-L.jpg mirrored half-faces
    results/<set>-split/<stem>-L.json       half-face results
"""

import json
from pathlib import Path

from .config import RESULTS
from .youcam import YouCam, raw_scores

# SD concerns most likely to appear in product claims. SD and HD can't be mixed in one task.
DEFAULT_ACTIONS = [
    "acne", "age_spot", "redness", "radiance", "texture",
    "pore", "wrinkle", "moisture", "oiliness", "dark_circle_v2",
]
IMAGE_EXTS = {".jpg", ".jpeg", ".png"}


def photo_files(folder: Path) -> list:
    if not folder.is_dir():
        return []
    return sorted(p for p in folder.iterdir() if p.suffix.lower() in IMAGE_EXTS)


def result_dir(set_name: str, split: bool) -> Path:
    return RESULTS / (set_name + ("-split" if split else ""))


def mirror_halves(photo: Path, out_dir: Path) -> list:
    """Write <stem>-L.jpg and <stem>-R.jpg: each image half joined to its own mirror image."""
    from PIL import Image, ImageOps

    out_dir.mkdir(parents=True, exist_ok=True)
    left_path, right_path = out_dir / f"{photo.stem}-L.jpg", out_dir / f"{photo.stem}-R.jpg"
    if left_path.exists() and right_path.exists():
        return [left_path, right_path]

    with Image.open(photo) as img:
        img = ImageOps.exif_transpose(img).convert("RGB")  # phone photos are often rotated via EXIF
    w, h = img.size
    mid = w // 2

    left = img.crop((0, 0, mid, h))
    composite = Image.new("RGB", (2 * mid, h))
    composite.paste(left, (0, 0))
    composite.paste(ImageOps.mirror(left), (mid, 0))
    composite.save(left_path, quality=95)

    right = img.crop((mid, 0, w, h))
    composite = Image.new("RGB", (2 * (w - mid), h))
    composite.paste(ImageOps.mirror(right), (0, 0))
    composite.paste(right, (w - mid, 0))
    composite.save(right_path, quality=95)
    return [left_path, right_path]


def analyze_cached(client: YouCam, photo: Path, out_dir: Path, actions=None) -> dict:
    """Return the cached result for photo, or analyse it (costs units) and cache it."""
    cache = out_dir / f"{photo.stem}.json"
    if cache.exists():
        return json.loads(cache.read_text(encoding="utf-8"))
    result = client.analyze(client.upload(photo), actions or DEFAULT_ACTIONS)
    out_dir.mkdir(parents=True, exist_ok=True)
    cache.write_text(json.dumps(result, indent=2), encoding="utf-8")
    return result


def cached_scores(out_dir: Path) -> dict:
    """{stem: {concern: raw_score}} for every cached result in out_dir."""
    return {
        f.stem: raw_scores(json.loads(f.read_text(encoding="utf-8")))
        for f in sorted(out_dir.glob("*.json"))
    }
