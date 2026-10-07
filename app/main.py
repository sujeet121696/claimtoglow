"""Local API for the trial lab: save gated photos, analyse them, read scores and noise.

Run: .venv/Scripts/python -m uvicorn app.main:app --port 8000
Photos stay on this machine. The server listens on localhost only; other devices reach it through
the Vite proxy (Wi-Fi) or a Cloudflare Tunnel, and need the lab token (see lock_remote_devices).
"""

import hashlib
import ipaddress
import json
import re
import secrets
import socket
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Literal

from fastapi import Body, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from .analyzer import DEFAULT_ACTIONS, analyze_cached, cached_scores, mirror_halves, photo_files, result_dir
from .claim import parse_claim
from .config import NAME_RE, PHOTOS, WEB_DIST, key_var_for, lab_token, person_of, public_url
from .llm import LLMError
from .masking import MASK_DIR, blanked_path, save_mask
from .noise import noise_rows, split_pairs
from .trials import PERSON_RE, day_of, people, read_trial, retire, retire_stale_results, summary, trial_verdict, write_trial
from .youcam import YouCam, YouCamError

MAX_UPLOAD_BYTES = 25 * 1024 * 1024

app = FastAPI(title="Claim to Glow lab")
PHOTOS.mkdir(exist_ok=True)
LAB_PORT = 5173  # where Vite serves the lab (npm run dev / dev:phone)


PRIVATE_PATHS = ("/api/", "/files/")  # the app shell is public; data and photos are not
OPEN_PATHS = ("/api/unlock",)  # how a locked device gets the token cookie
TOKEN_COOKIE = "lab_token"


def token_ok(token: str) -> bool:
    return secrets.compare_digest(token.encode(), lab_token().encode())


def client_ip(request: Request) -> str:
    """The real client: Vite's proxy and Cloudflare both append it as the last X-Forwarded-For entry."""
    forwarded = request.headers.get("x-forwarded-for")
    return forwarded.split(",")[-1].strip() if forwarded else (request.client.host if request.client else "")


def is_local(request: Request) -> bool:
    """A request from this PC. Tunnel traffic also reaches us from localhost (cloudflared), so
    anything carrying Cloudflare's Cf-Connecting-IP header is remote, whatever its address."""
    if "cf-connecting-ip" in request.headers:
        return False
    try:
        return ipaddress.ip_address(client_ip(request).removeprefix("::ffff:")).is_loopback
    except ValueError:
        return False


@app.middleware("http")
async def lock_remote_devices(request: Request, call_next):
    """Photos are faces and analyses cost units: any device other than this PC (phone on Wi-Fi,
    or a teammate through the tunnel) needs the lab token, which it gets once from the lab link."""
    private = request.url.path.startswith(PRIVATE_PATHS)
    if private and request.url.path not in OPEN_PATHS and not is_local(request):
        if request.url.path.startswith("/files/photos/") and f"/{MASK_DIR}/" not in request.url.path:
            return JSONResponse({"detail": "Other devices only get photos with the background removed."},
                                status_code=403, headers={"Cache-Control": "private, no-store"})
        token = request.cookies.get(TOKEN_COOKIE, "")
        if not token_ok(token):
            reason = "has an old or wrong lab link" if token else "hasn't opened the lab link yet"
            return JSONResponse(
                {"detail": f"Locked: this device {reason}. On the PC open Today → “Open on phone”, then scan the code or open the copied link."},
                status_code=401, headers={"Cache-Control": "private, no-store"},
            )
    response = await call_next(request)
    if private:
        response.headers["Cache-Control"] = "private, no-store"  # Cloudflare and browsers never keep faces or scores
    return response


_clients = {}


def client(set_name: str) -> YouCam:
    var = key_var_for(set_name)
    if var not in _clients:
        try:
            _clients[var] = YouCam.from_env(var)
        except RuntimeError as e:
            raise HTTPException(500, str(e))
    return _clients[var]


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
    actual = sha256(photo)
    return {
        "stem": photo.stem,
        "file": photo.name,
        "url": f"/files/photos/{name}/{photo.name}",
        "masked_url": masked_url(name, photo.stem),
        "sha256": actual,
        # The fingerprint saved at capture no longer matches the file: it was replaced or edited.
        "tampered": bool(meta.get("sha256")) and meta["sha256"] != actual,
        "meta": meta,
        "scores": whole.get(photo.stem),
        "split": {"L": halves[photo.stem][0], "R": halves[photo.stem][1]} if photo.stem in halves else None,
    }


def masked_url(name: str, stem: str):
    """The copy with the background removed: the only version other devices may load."""
    path = blanked_path(name, stem)
    return f"/files/photos/{name}/{MASK_DIR}/{path.name}" if path else None


def next_stem(name: str) -> str:
    """Daily photos are named by days since the trial's start; other sets count up (shot-NN)."""
    taken = {p.stem for p in photo_files(set_dir(name))}
    person = person_of(name)
    if name.startswith("trial-") and person:
        day = day_of(read_trial(person))
        if day is not None:
            if day < 0:
                raise HTTPException(400, f"The trial starts on {read_trial(person)['start_date']}.")
            stem = f"day-{day:02d}"
            if stem in taken:
                raise HTTPException(409, f"Today's check-in ({stem}) already exists. Use Retake on it first.")
            return stem
    prefix = "day" if name.startswith("trial") else "shot"
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
    return {
        "name": name,
        "key_var": key_var_for(name),  # which account pays for analyses of this set (never the key itself)
        "photos": [photo_info(name, p, whole, halves) for p in photo_files(set_dir(name))],
    }


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
    retire_stale_results(name, stem)
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
    try:
        targets = mirror_halves(photo, out_dir / "images") if split else [photo]
    except OSError as e:
        raise HTTPException(422, f"Could not read {photo.name} as an image: {e}")
    try:
        for target in targets:
            analyze_cached(client(name), target, out_dir)
    except YouCamError as e:
        raise HTTPException(422, {"code": e.code, "message": e.message})
    except RuntimeError as e:
        raise HTTPException(502, str(e))
    return get_set(name)


@app.post("/api/sets/{name}/photos/{stem}/mask")
async def upload_mask(name: str, stem: str, file: UploadFile = File(...)):
    """Person mask from the browser (white = person); stores it and the background-free copy."""
    photo = find_photo(name, stem)
    data = await file.read()
    if not data or len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(400, "Empty or too large mask")
    try:
        save_mask(photo, name, data)
    except OSError as e:
        raise HTTPException(422, f"Could not read the mask: {e}")
    except ValueError as e:
        raise HTTPException(422, str(e))
    return photo_info(name, photo, {}, {})


@app.post("/api/sets/{name}/photos/{stem}/gate")
def save_gate(name: str, stem: str, gate: dict = Body(..., embed=True)):
    """Store the capture-gate result for a photo copied in by hand (the gate runs in the browser)."""
    photo = find_photo(name, stem)
    meta = read_meta(photo) or {"sha256": sha256(photo), "source": "folder"}
    meta["gate"] = gate
    photo.with_suffix(".meta.json").write_text(json.dumps(meta, indent=2), encoding="utf-8")
    return photo_info(name, photo, {}, {})


@app.post("/api/sets/{name}/photos/{stem}/retire")
def retire_photo(name: str, stem: str):
    """Move a photo and its analyses to photos/_retired/ so it can be retaken. Nothing is deleted."""
    return {"moved_to": retire(name, find_photo(name, stem))}


class TrialFields(BaseModel):
    product: str = ""
    claim: str = ""
    notes: str = ""
    treated_side: Literal["L", "R"] = "L"
    start_date: date | None = None
    duration_days: int = 21
    concerns: list[Literal[tuple(DEFAULT_ACTIONS)]] = []  # what the claim says will change


class Unlock(BaseModel):
    token: str


@app.post("/api/unlock")
def unlock(body: Unlock, request: Request):
    """Turns the token from a lab link into a cookie set by the server: phone browsers keep it more
    reliably than one set by page script, and HttpOnly keeps it away from scripts."""
    if not token_ok(body.token):
        raise HTTPException(403, "This lab link is old or wrong. Copy it again from “Open on phone” on the PC.")
    response = JSONResponse({"unlocked": True})
    https = request.headers.get("x-forwarded-proto", request.url.scheme) == "https"
    response.set_cookie(TOKEN_COOKIE, body.token, max_age=365 * 24 * 3600, httponly=True, secure=https, samesite="lax")
    return response


@app.get("/api/lab-link")
def lab_link():
    """Links that open and unlock the lab on another device (shown as a QR code): `wifi` for a
    phone on the same Wi-Fi (npm run dev:phone), `public` through the Cloudflare Tunnel when set."""
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        try:
            s.connect(("10.255.255.255", 1))  # no packet is sent; this only picks the LAN interface
            ip = s.getsockname()[0]
        except OSError:
            ip = "127.0.0.1"
    unlock = f"/?token={lab_token()}#/capture"
    public = public_url()
    return {"wifi": f"https://{ip}:{LAB_PORT}{unlock}", "public": f"{public}{unlock}" if public else None}


@app.get("/api/people")
def list_people():
    return {"people": [summary(p, read_meta) for p in people()], "today": date.today().isoformat()}


class ClaimText(BaseModel):
    claim: str
    product: str = ""


@app.post("/api/claims/parse")
def claims_parse(body: ClaimText):
    """Claim agent: suggests the concerns and deadline a claim promises (a person confirms them)."""
    if not body.claim.strip():
        raise HTTPException(400, "Write the claim first.")
    try:
        return parse_claim(body.claim, body.product)
    except LLMError as e:
        raise HTTPException(502, str(e))


@app.get("/api/people/{person}/verdict")
def person_verdict(person: str):
    if person not in people():
        raise HTTPException(404, f"No trial for {person!r}")
    return trial_verdict(person)


@app.put("/api/people/{person}")
def save_person(person: str, fields: TrialFields):
    if not PERSON_RE.match(person):
        raise HTTPException(400, "Use lowercase letters, digits and dashes, e.g. 'sahni'.")
    data = fields.model_dump()
    data["start_date"] = fields.start_date.isoformat() if fields.start_date else None
    write_trial(person, data)
    return summary(person, read_meta)


@app.get("/api/sets/{name}/noise")
def noise(name: str, split: bool = False):
    set_dir(name)
    return {"rows": noise_rows(cached_scores(result_dir(name, split)), split)}


@app.get("/api/sets/{name}/reference")
def reference(name: str):
    """The person's day-0 photo and its capture metrics, used for the ghost overlay and matching."""
    set_dir(name)
    person = person_of(name)
    if not person:
        return None
    # Both trial-<person> and noise-<person> are matched against trial-<person>/day-00.
    ref_set = f"trial-{person}"
    for p in photo_files(PHOTOS / ref_set):
        if p.stem == "day-00":
            return {"set": ref_set, "url": f"/files/photos/{ref_set}/{p.name}",
                    "masked_url": masked_url(ref_set, p.stem), "meta": read_meta(p)}
    return None


app.mount("/files/photos", StaticFiles(directory=PHOTOS), name="photos")

# The built web app (npm run build), so one server on one port can sit behind the tunnel.
# Mounted last: every /api and /files route above wins.
if WEB_DIST.is_dir():
    app.mount("/", StaticFiles(directory=WEB_DIST, html=True), name="web")
