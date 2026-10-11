"""Admin API (/api/admin/…), for accounts that are admins (auth.require_admin), from this PC too.

- Overview: every trial in one table, YouCam usage per key, the latest access-log entries.
- Users: add, change role, turn off or on, set a password, remove. Nobody can change or remove their
  own account or an owner's (ADMIN_EMAILS) here: no lock-outs, and no admin can take over an owner.
- Settings: units granted per YouCam key (for "units left"), and whether other devices may still use
  the lab link or must sign in.
Every change is written to the access log.
"""

import re
import sqlite3
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from .auth import (REMOTE_ACCESS, account_problem, admin_emails, forget_remote_access, hash_password, insert_account,
                   is_admin, password_problem, remote_access, require_admin)
from .config import PHOTOS, RESULTS, key_var_for, load_env
from .db import connect, get_setting, log_access, put_setting
from .net import client_ip, device, same_site
from .trials import people, summary

router = APIRouter(prefix="/api/admin")

UNITS_PER_ANALYSIS = 14  # SD analysis with 10 concerns (ARCHITECTURE, YouCam console Oct 6); split-face = 2


def _from_admin_page(request: Request) -> None:
    if not same_site(request):
        raise HTTPException(403, "Make changes from the admin page.")


def _log(request: Request, admin: dict, what: str) -> None:
    """Written after a change succeeded, so the log never shows one that didn't happen."""
    log_access("admin", email=admin["email"], ip=client_ip(request), device=device(request), detail=what)


# ---------- Overview ----------

def _set_of(folder: str) -> str:
    return folder.removesuffix("-split")


def usage() -> list:
    """Successful analyses per YouCam key, counted from the saved results (current and retired).
    Each result file is one billed call: a whole face, or one half of a split face."""
    counts = {}
    sources = [(d.name, d) for d in RESULTS.iterdir() if d.is_dir()] if RESULTS.is_dir() else []
    retired = PHOTOS / "_retired"
    if retired.is_dir():
        sources += [(d.name, d) for d in retired.glob("*/*/results/*") if d.is_dir()]
    for folder, path in sources:
        n = sum(1 for _ in path.glob("*.json"))
        if n:
            var = key_var_for(_set_of(folder))
            counts[var] = counts.get(var, 0) + n
    load_env()
    rows = []
    for var in sorted(counts):
        granted = get_setting(f"units_granted:{var}")
        used = counts[var] * UNITS_PER_ANALYSIS
        rows.append({"key_var": var, "analyses": counts[var], "units_used": used,
                     "units_granted": int(granted) if granted.isdigit() else None,
                     "units_left": int(granted) - used if granted.isdigit() else None})
    return rows


def _trial_row(person: str) -> dict:
    s = summary(person)
    return {
        "person": person, "product": s["product"], "day": s["day"], "duration_days": s["duration_days"],
        "today_count": s["today_count"], "today_target": s["today_target"], "today_done": s["today_done"],
        "latest": s["latest"] and {"stem": s["latest"]["stem"], "gate_passed": s["latest"]["gate_passed"]},
        "verdict": s["verdict"]["status"], "reminder_time": s.get("reminder_time"), "key_var": s["key_var"],
    }


@router.get("/overview")
def overview(_: dict = Depends(require_admin)):
    with connect() as con:
        log = [dict(r) for r in con.execute(
            "SELECT at, event, email, method, ip, device, ok, detail FROM access_log ORDER BY id DESC LIMIT 200")]
    return {
        "trials": [_trial_row(p) for p in people()],
        "usage": usage(),
        "units_per_analysis": UNITS_PER_ANALYSIS,
        "log": log,
        "settings": {"remote_access": remote_access()},
    }


# ---------- Users ----------

def _users() -> list:
    owners = admin_emails()
    with connect() as con:
        rows = con.execute("SELECT u.*, (SELECT group_concat(provider) FROM identities i WHERE i.user_id = u.id) AS providers"
                           " FROM users u ORDER BY u.created_at").fetchall()
    return [{
        "id": r["id"], "email": r["email"], "username": r["username"], "name": r["name"],
        "admin": is_admin(dict(r)), "owner": r["email"] in owners, "disabled": bool(r["disabled"]),
        "has_password": bool(r["password_hash"]),
        "methods": sorted(set((r["providers"] or "").split(",")) - {""}) + (["password"] if r["password_hash"] else []),
        "created_at": r["created_at"], "last_seen_at": r["last_seen_at"],
    } for r in rows]


@router.get("/users")
def list_users(_: dict = Depends(require_admin)):
    return {"users": _users()}


class NewUser(BaseModel):
    email: str = Field(max_length=200)
    username: str = Field("", max_length=32)
    name: str = Field("", max_length=100)
    admin: bool = False
    password: str = ""  # optional: without one, the person signs in with Google, GitHub or LinkedIn


@router.post("/users")
def add_user(body: NewUser, request: Request, admin: dict = Depends(require_admin)):
    email, username = body.email.strip().lower(), body.username.strip().lower() or None
    if problem := account_problem(email, username, body.password):
        raise HTTPException(400, problem)
    _from_admin_page(request)
    try:
        with connect() as con:
            insert_account(con, email, username=username, name=body.name.strip() or None, admin=body.admin,
                           password=body.password or None)
    except sqlite3.IntegrityError:
        raise HTTPException(409, "That email or username already has an account.")
    _log(request, admin, f"added {email}{' as admin' if body.admin else ''}")
    return {"users": _users()}


class UserChange(BaseModel):
    admin: bool | None = None
    disabled: bool | None = None
    password: str | None = None


@router.patch("/users/{user_id}")
def change_user(user_id: int, body: UserChange, request: Request, admin: dict = Depends(require_admin)):
    with connect() as con:
        row = con.execute("SELECT id, email FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        raise HTTPException(404, "No such account.")
    if row["id"] == admin["id"]:
        raise HTTPException(400, "Change your own account from this PC (python -m app.users), not here.")
    if row["email"] in admin_emails():  # else another admin could set an owner's password and take over
        raise HTTPException(400, "Owners (ADMIN_EMAILS in .env) are changed on the PC: python -m app.users.")
    if body.password is not None and (problem := password_problem(body.password)):
        raise HTTPException(400, problem)
    _from_admin_page(request)
    with connect() as con:
        if body.admin is not None:
            con.execute("UPDATE users SET role = ? WHERE id = ?", ("admin" if body.admin else "member", user_id))
        if body.disabled is not None:
            con.execute("UPDATE users SET disabled = ? WHERE id = ?", (int(body.disabled), user_id))
        if body.password is not None:
            con.execute("UPDATE users SET password_hash = ? WHERE id = ?", (hash_password(body.password), user_id))
        if body.disabled or body.password is not None:
            con.execute("DELETE FROM sessions WHERE user_id = ?", (user_id,))  # signed out everywhere
    changes = [k for k in ("admin", "disabled", "password") if getattr(body, k) is not None]
    _log(request, admin, f"changed {row['email']}: {', '.join(changes) or 'nothing'}")
    return {"users": _users()}


@router.delete("/users/{user_id}")
def remove_user(user_id: int, request: Request, admin: dict = Depends(require_admin)):
    with connect() as con:
        row = con.execute("SELECT id, email FROM users WHERE id = ?", (user_id,)).fetchone()
    if not row:
        raise HTTPException(404, "No such account.")
    if row["id"] == admin["id"] or row["email"] in admin_emails():
        raise HTTPException(400, "You can't remove your own account or an owner's.")
    _from_admin_page(request)
    with connect() as con:
        con.execute("DELETE FROM users WHERE id = ?", (user_id,))  # its sessions and linked sign-ins go with it
    _log(request, admin, f"removed {row['email']}")
    return {"users": _users()}


# ---------- Settings ----------

class Settings(BaseModel):
    remote_access: Literal[REMOTE_ACCESS] | None = None
    units_granted: dict[str, int] | None = None  # {"YOUCAM_API_SAHNI_KEY": 2000}


@router.put("/settings")
def save_settings(body: Settings, request: Request, admin: dict = Depends(require_admin)):
    if body.units_granted:
        for var, units in body.units_granted.items():
            if not re.fullmatch(r"YOUCAM_API(_[A-Z0-9_]+)?_KEY", var) or not 0 <= units <= 10_000_000:
                raise HTTPException(400, f"Bad units for {var}.")
    _from_admin_page(request)
    if body.remote_access:
        put_setting("remote_access", body.remote_access)
        forget_remote_access()
    for var, units in (body.units_granted or {}).items():
        put_setting(f"units_granted:{var}", str(units))
    _log(request, admin, "settings: " + ", ".join(k for k, v in body.model_dump().items() if v is not None))
    return overview(admin)
