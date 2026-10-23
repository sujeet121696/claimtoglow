"""Local API for the trial lab: save gated photos, analyse them, read scores and noise.

Run: .venv/Scripts/python -m uvicorn app.main:app --port 8000
Photos stay on this machine. The server listens on localhost only; other devices reach it through
the Vite proxy (Wi-Fi) or a Cloudflare Tunnel, and need the lab token or a sign-in (see lock_remote_devices).
"""

import hashlib
import logging
import json
import time
import re
import secrets
import socket
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Literal

from fastapi import Body, FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse, JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from starlette.exceptions import HTTPException as StarletteHTTPException
from pydantic import BaseModel, Field

from .admin import router as admin_router
from .analyzer import DEFAULT_ACTIONS, analyze_cached, cached_scores, mirror_halves, photo_files, result_dir
from .auth import current_user, remote_access, router as auth_router
from .claim import parse_claim
from .config import NAME_RE, PHOTOS, WEB_DEMO, WEB_DIST, key_var_for, lab_token, person_of, public_url
from .db import log_access
from .llm import LLMError
from .masking import MASK_DIR, THUMB_DIR, make_thumb, masked_urls, save_mask
from .net import client_ip, device, is_https, is_local
from .noise import noise_rows, split_pairs
from .demo import demo_people, demo_timeline
from .receipt import badge_svg, receipt, timeline
from .trials import (PERSON_RE, day_of, people, read_meta, read_trial, retire, retire_stale_results, summary,
                     today_photos, trial_verdict, write_trial)
from .youcam import YouCam, YouCamError

MAX_UPLOAD_BYTES = 25 * 1024 * 1024

app = FastAPI(title="Claim to Glow lab")
log = logging.getLogger("uvicorn.error")  # shows in the server console beside the request lines
PHOTOS.mkdir(exist_ok=True)
LAB_PORT = 5173  # where Vite serves the lab (npm run dev / dev:phone)


app.include_router(auth_router)
app.include_router(admin_router)

PRIVATE_PATHS = ("/api/", "/files/")  # the app shell is public; data and photos are not
# How a locked device gets in: the token cookie (unlock) or a sign-in (/api/me, /api/auth/…).
OPEN_PATHS = ("/api/unlock", "/api/me")
TOKEN_COOKIE = "lab_token"


def token_ok(token: str) -> bool:
    return secrets.compare_digest(token.encode(), lab_token().encode())


@app.middleware("http")
async def lock_remote_devices(request: Request, call_next):
    """Photos are faces and analyses cost units. Who gets in depends on Admin → Settings → Who
    gets in: "Lab link or sign-in" lets this PC in freely and other devices with the lab token or a
    sign-in; "Sign-in only" asks every device for a sign-in, this PC too. Original photos never go to
    another device. The admin API also checks for an admin (admin.py)."""
    path = request.url.path
    private = path.startswith(PRIVATE_PATHS)
    if private and path not in OPEN_PATHS and not path.startswith("/api/auth/"):
        local = is_local(request)
        if not local and path.startswith("/files/photos/") and f"/{MASK_DIR}/" not in path:
            return JSONResponse({"detail": "Other devices only get photos with the background removed."},
                                status_code=403, headers={"Cache-Control": "private, no-store"})
        link_allowed = remote_access() == "link_or_signin"
        if not (local and link_allowed):
            user = current_user(request)
            token = request.cookies.get(TOKEN_COOKIE, "")
            if not user and not (link_allowed and token_ok(token)):
                reason = ("needs a sign-in" if not link_allowed
                          else "has an old or wrong lab link" if token else "hasn't opened the lab link or signed in yet")
                return JSONResponse({"detail": f"Locked: this device {reason}."},
                                    status_code=401, headers={"Cache-Control": "private, no-store"})
            if path == "/api/people" and not local:  # the lab loading: note who opened it
                note_visit(request, user)
    response = await call_next(request)
    if private:
        response.headers["Cache-Control"] = private_cache(path, bool(request.query_params.get("v")), response.status_code)
    elif request.url.path.startswith("/demo/data/"):
        response.headers["Cache-Control"] = "no-store"  # live demo data: Cloudflare and browsers never keep a stale copy
    else:
        response.headers.setdefault("Cache-Control", public_cache(path, response.status_code))
    return response


def public_cache(path: str, status: int) -> str:
    """The app shell and demo: Vite's hashed files (/assets/, /demo/assets/) change name with every
    build, so they are kept for good; pages, icons and fonts are checked again on every load (a quick
    304 when unchanged), so a new build shows up without a hard reload."""
    if status == 200 and path.startswith(("/assets/", "/demo/assets/")):
        return "public, max-age=31536000, immutable"
    return "no-cache"


def private_cache(path: str, versioned: bool, status: int) -> str:
    """A background-free photo at a versioned URL (masking.masked_urls) never changes, so the
    browser keeps it; "private" keeps it out of Cloudflare, and a new version gets a new URL.
    Scores, originals and everything else: Cloudflare and browsers never keep them."""
    if status == 200 and versioned and path.startswith("/files/photos/") and f"/{MASK_DIR}/" in path:
        return "private, max-age=31536000, immutable"
    return "private, no-store"


_visits = {}
VISIT_EVERY_SECONDS = 3600


def note_visit(request: Request, user: dict | None) -> None:
    """Access log: a device opening the lab, at most once an hour per person and device. Cloudflare
    Access's verified email is noted when there is no sign-in (only for the log)."""
    who = user["email"] if user else request.headers.get("cf-access-authenticated-user-email")
    method = "session" if user else "lab link"
    key = (who, method, client_ip(request), device(request))
    if time.monotonic() - _visits.get(key, -VISIT_EVERY_SECONDS) >= VISIT_EVERY_SECONDS:
        _visits[key] = time.monotonic()
        log_access("lab-open", email=who, method=method, ip=key[2], device=key[3])


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


def photo_info(name: str, photo: Path, whole: dict, halves: dict) -> dict:
    meta = read_meta(photo) or {}
    actual = sha256(photo)
    return {
        "stem": photo.stem,
        "file": photo.name,
        "url": f"/files/photos/{name}/{photo.name}",
        **masked_urls(name, photo.stem),
        "sha256": actual,
        # The fingerprint saved at capture no longer matches the file: it was replaced or edited.
        "tampered": bool(meta.get("sha256")) and meta["sha256"] != actual,
        "meta": meta,
        "scores": whole.get(photo.stem),
        "split": {"L": halves[photo.stem][0], "R": halves[photo.stem][1]} if photo.stem in halves else None,
    }


def next_stem(name: str) -> str:
    """Daily photos are named by days since the trial's start (day-07, day-07b, day-07c on a
    checkpoint day); other sets count up (shot-NN)."""
    taken = {p.stem for p in photo_files(set_dir(name))}
    person = person_of(name)
    if name.startswith("trial-") and person:
        trial = read_trial(person)
        day = day_of(trial)
        if day is not None:
            if day < 0:
                raise HTTPException(400, f"The trial starts on {trial['start_date']}.")
            if day > trial["duration_days"]:
                raise HTTPException(400, f"The trial ended on day {trial['duration_days']}.")
            today = today_photos(trial, day, taken)
            if today["next"] is None:
                done = "all 3 check-in photos" if today["target"] > 1 else f"today's check-in (day-{day:02d})"
                raise HTTPException(409, f"Already have {done}. Use Retake on one first.")
            return today["next"]
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
        log.warning("analyse %s/%s: unreadable image: %s", name, stem, e)
        raise HTTPException(422, f"Could not read {photo.name} as an image: {e}")
    try:
        for target in targets:
            analyze_cached(client(name), target, out_dir)
    except YouCamError as e:
        log.warning("analyse %s/%s split=%s: YouCam rejected it: %s: %s", name, stem, split, e.code, e.message)
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


class Reminder(BaseModel):
    time: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")  # "19:00", local time


class Unlock(BaseModel):
    token: str


@app.post("/api/unlock")
def unlock(body: Unlock, request: Request):
    """Turns the token from a lab link into a cookie set by the server: phone browsers keep it more
    reliably than one set by page script, and HttpOnly keeps it away from scripts."""
    valid, allowed = token_ok(body.token), remote_access() == "link_or_signin"
    log_access("unlock", method="lab link", ip=client_ip(request), device=device(request), ok=valid and allowed,
               email=request.headers.get("cf-access-authenticated-user-email"),
               detail=None if valid and allowed else "wrong or old link" if not valid else "lab links are off")
    if not valid:
        raise HTTPException(403, "This lab link is old or wrong. Copy it again from “Open on phone” on the PC.")
    if not allowed:
        raise HTTPException(403, "Lab links are turned off. Sign in with your account instead.")
    response = JSONResponse({"unlocked": True})
    response.set_cookie(TOKEN_COOKIE, body.token, max_age=365 * 24 * 3600, httponly=True, secure=is_https(request), samesite="lax")
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
    unlock = f"/capture?token={lab_token()}"
    public = public_url()
    return {"wifi": f"https://{ip}:{LAB_PORT}{unlock}", "public": f"{public}{unlock}" if public else None}


@app.get("/api/people")
def list_people():
    return {"people": [summary(p) for p in people()], "today": date.today().isoformat()}


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


@app.get("/api/people/{person}/timeline")
def person_timeline(person: str):
    if person not in people():
        raise HTTPException(404, f"No trial for {person!r}")
    return timeline(person)


@app.get("/api/people/{person}/receipt")
def person_receipt(person: str):
    if person not in people():
        raise HTTPException(404, f"No trial for {person!r}")
    return receipt(person)


@app.get("/api/people/{person}/badge.svg")
def person_badge(person: str):
    if person not in people():
        raise HTTPException(404, f"No trial for {person!r}")
    return Response(badge_svg(trial_verdict(person)["status"]), media_type="image/svg+xml")


@app.put("/api/people/{person}")
def save_person(person: str, fields: TrialFields):
    if not PERSON_RE.match(person):
        raise HTTPException(400, "Use lowercase letters, digits and dashes, e.g. 'sahni'.")
    data = fields.model_dump()
    data["start_date"] = fields.start_date.isoformat() if fields.start_date else None
    write_trial(person, data)
    return summary(person)


@app.put("/api/people/{person}/reminder")
def save_reminder(person: str, body: Reminder):
    """The time of this person's daily calendar reminder, saved when it is added (Today card).
    Kept apart from save_person so the trial form doesn't overwrite it."""
    if person not in people():
        raise HTTPException(404, f"No trial for {person!r}")
    write_trial(person, {"reminder_time": body.time})
    return summary(person)


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
                    **masked_urls(ref_set, p.stem), "meta": read_meta(p)}
    return None


@app.get(f"/files/photos/{{name}}/{MASK_DIR}/{THUMB_DIR}/{{file}}")
def thumbnail(name: str, file: str):
    """Small background-free copy for lists and cards, made on first request (masking.make_thumb)."""
    stem = file.removesuffix(".jpg")
    find_photo(name, stem)  # checks the set name and that the photo exists
    thumb = make_thumb(name, stem)
    if not thumb:
        raise HTTPException(404, "No background-free copy yet")
    return FileResponse(thumb, media_type="image/jpeg")


app.mount("/files/photos", StaticFiles(directory=PHOTOS), name="photos")

# Read-only judge demo: live, face-free data (public, like the app shell), so the demo is always
# current. The demo app itself is built once with `npm run build:demo`.
@app.get("/demo/data/people.json")
def demo_people_data():
    return demo_people()


@app.get("/demo/data/{person}/{file}")
def demo_person_data(person: str, file: Literal["timeline.json", "receipt.json", "badge.svg"]):
    if person not in people():
        raise HTTPException(404, f"No trial for {person!r}")
    if file == "timeline.json":
        return demo_timeline(person)
    if file == "receipt.json":
        return receipt(person)
    return Response(badge_svg(trial_verdict(person)["status"]), media_type="image/svg+xml")


if WEB_DEMO.is_dir():
    app.mount("/demo", StaticFiles(directory=WEB_DEMO, html=True), name="demo")

class AppFiles(StaticFiles):
    """The built app. A page address without a file (/today, /login?code=…) gets index.html, so
    clean links and reloads work; anything under /api, /files or /demo stays a plain 404."""

    async def get_response(self, path: str, scope):
        try:
            return await super().get_response(path, scope)
        except StarletteHTTPException as e:
            parts = path.replace("\\", "/").split("/")  # the OS separator: a backslash on Windows
            if e.status_code != 404 or "." in parts[-1] or parts[0] in ("api", "files", "demo"):
                raise
            return await super().get_response("index.html", scope)


# The built web app (npm run build), so one server on one port can sit behind the tunnel.
# Mounted last: every /api, /files and /demo route above wins.
if WEB_DIST.is_dir():
    app.mount("/", AppFiles(directory=WEB_DIST, html=True), name="web")
