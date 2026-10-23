"""Background removal: only the person is shown on other devices (VISION D9, data minimisation).

The browser segments each photo (MediaPipe selfie segmenter) and uploads a grey mask, white =
person. Here the mask becomes a copy of the photo with the room replaced by flat grey:
    photos/<set>/_mask/<stem>.png   mask from the browser
    photos/<set>/_mask/<stem>.jpg   the photo with the background blanked
    photos/<set>/_mask/thumb/<stem>.jpg   a small copy of it for lists and cards
The original is unchanged and is still what YouCam analyses, until a test shows that blanked
photos score the same (TASKS.md).
"""

import os
from pathlib import Path

from .config import PHOTOS

BACKGROUND = (192, 192, 192)  # flat light grey
MIN_PERSON_SHARE = 0.05  # a mask with less person than this is a failed segmentation
MASK_DIR = "_mask"
THUMB_DIR = "thumb"
THUMB_WIDTH = 480  # sharp at 2x on the widest card; ~30 KB instead of ~450 KB


def mask_files(set_name: str, stem: str) -> list:
    """Mask, blanked copy and its thumbnail (moved together on a Retake)."""
    folder = PHOTOS / set_name / MASK_DIR
    return [folder / f"{stem}.png", folder / f"{stem}.jpg", folder / THUMB_DIR / f"{stem}.jpg"]


def masked_urls(set_name: str, stem: str) -> dict:
    """URLs of the blanked copy and its thumbnail. `?v=` changes whenever the copy is rewritten
    (new mask, retaken photo), so browsers may keep each version for good (main.py)."""
    path = blanked_path(set_name, stem)
    if not path:
        return {"masked_url": None, "thumb_url": None}
    st = path.stat()
    v = f"{st.st_mtime_ns:x}{st.st_size:x}"
    base = f"/files/photos/{set_name}/{MASK_DIR}"
    return {"masked_url": f"{base}/{path.name}?v={v}", "thumb_url": f"{base}/{THUMB_DIR}/{path.name}?v={v}"}


def blanked_path(set_name: str, stem: str):
    path = mask_files(set_name, stem)[1]
    return path if path.exists() else None


def save_mask(photo: Path, set_name: str, png: bytes) -> Path:
    """Store the mask and write the blanked copy. Raises OSError for a file that isn't an image and
    ValueError for an empty mask (failed segmentation), so a bad mask is never stored."""
    from io import BytesIO

    from PIL import Image, ImageFilter, ImageOps

    mask_png, out, _ = mask_files(set_name, photo.stem)
    with Image.open(BytesIO(png)) as m:
        mask = m.convert("L")
    small = mask.resize((64, 64))
    if sum(v > 128 for v in small.tobytes()) / (64 * 64) < MIN_PERSON_SHARE:
        raise ValueError("No person found in the mask")
    with Image.open(photo) as img:
        img = ImageOps.exif_transpose(img).convert("RGB")  # the browser segments the upright image
    # Confidence below ~0.3 is background, above ~0.7 is the person; soften the edge slightly.
    mask = mask.resize(img.size, Image.BILINEAR).point(lambda v: min(255, max(0, (v - 77) * 255 // 102)))
    mask = mask.filter(ImageFilter.GaussianBlur(2))
    out.parent.mkdir(exist_ok=True)
    Image.composite(img, Image.new("RGB", img.size, BACKGROUND), mask).save(out, quality=92)
    mask_png.write_bytes(png)
    make_thumb(set_name, photo.stem)
    return out


def make_thumb(set_name: str, stem: str):
    """The thumbnail of the blanked copy, made on first use and again whenever the copy is newer.
    Returns None when there is no blanked copy."""
    from PIL import Image

    _, src, thumb = mask_files(set_name, stem)
    if not src.exists():
        return None
    made_from = src.stat().st_mtime_ns  # the thumbnail carries its copy's time, so any change is seen
    if not thumb.exists() or thumb.stat().st_mtime_ns != made_from:
        thumb.parent.mkdir(exist_ok=True)
        with Image.open(src) as img:
            img.thumbnail((THUMB_WIDTH, THUMB_WIDTH * 4))
            tmp = thumb.with_suffix(".tmp")
            img.save(tmp, "JPEG", quality=80, optimize=True, progressive=True)
        os.utime(tmp, ns=(made_from, made_from))
        tmp.replace(thumb)  # never serve a half-written file
    return thumb
