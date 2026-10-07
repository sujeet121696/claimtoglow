"""Background removal: only the person is shown on other devices (VISION D9, data minimisation).

The browser segments each photo (MediaPipe selfie segmenter) and uploads a grey mask, white =
person. Here the mask becomes a copy of the photo with the room replaced by flat grey:
    photos/<set>/_mask/<stem>.png   mask from the browser
    photos/<set>/_mask/<stem>.jpg   the photo with the background blanked
The original is unchanged and is still what YouCam analyses, until a test shows that blanked
photos score the same (TASKS.md).
"""

from pathlib import Path

from .config import PHOTOS

BACKGROUND = (192, 192, 192)  # flat light grey
MIN_PERSON_SHARE = 0.05  # a mask with less person than this is a failed segmentation
MASK_DIR = "_mask"


def mask_files(set_name: str, stem: str) -> list:
    folder = PHOTOS / set_name / MASK_DIR
    return [folder / f"{stem}.png", folder / f"{stem}.jpg"]


def blanked_path(set_name: str, stem: str):
    path = mask_files(set_name, stem)[1]
    return path if path.exists() else None


def save_mask(photo: Path, set_name: str, png: bytes) -> Path:
    """Store the mask and write the blanked copy. Raises OSError for a file that isn't an image and
    ValueError for an empty mask (failed segmentation), so a bad mask is never stored."""
    from io import BytesIO

    from PIL import Image, ImageFilter, ImageOps

    mask_png, out = mask_files(set_name, photo.stem)
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
    return out
