"""Sign-in: Google, GitHub and LinkedIn (OAuth), a one-time email link, and username or email + password.

Invite-only. An account exists because its email is in ADMIN_EMAILS (.env, the owners) or because
an admin added it on the admin page; anyone else is turned away, even with a valid Google account.
A provider only signs someone in when it says the email is verified. A provider with no keys in .env
is simply not offered (/api/me lists the ones that are).

OAuth: /api/auth/start?provider=…&next=… sets a short-lived cookie with a random `state` and sends
the browser to the provider; /api/auth/callback/<provider> checks that state, swaps the code for the
person's verified email, and starts a session.

Email link (as kharidwise): POST /api/auth/email mails a link to /login?code=… (invited emails
only, at most one a minute per address; the reply is the same either way, so it reveals no
accounts). That page asks for a press on "Sign in", which POSTs the token to /api/auth/email-verify:
the extra press stops email scanners that open links from using it up. A link works once, for 15 minutes.

Sessions: the cookie holds a random token, the database only its SHA-256, so a copy of lab.db can't
be used to sign in. The cookie is HttpOnly, SameSite=Lax, and Secure on https.
"""

import hashlib
import hmac
import json
import os
import re
import secrets
import time
import urllib.error
import urllib.request
from datetime import datetime, timedelta, timezone
from urllib.parse import quote, unquote, urlencode

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel, Field

from .config import load_env, public_url
from .db import connect, get_setting, log_access, now, prune_log
from .mail import can_mail, send_mail
from .net import client_ip, device, is_https, origin, same_site

router = APIRouter()

SESSION_COOKIE = "session"
SESSION_DAYS = 30
STATE_COOKIE = "oauth_state"
FAILS_PER_IP = 10  # failed password sign-ins per address in FAIL_WINDOW before it has to wait
FAILS_PER_LOGIN = 5  # … and per account name
FAIL_WINDOW = timedelta(minutes=15)
LINK_MINUTES = 15
LINKS_PER_HOUR = 30  # all addresses together: a cap on mail sent if the form is abused


# ---------- Passwords (scrypt, stdlib) ----------

SCRYPT = {"n": 2 ** 14, "r": 8, "p": 1}


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.scrypt(password.encode(), salt=salt, dklen=32, **SCRYPT)
    return f"scrypt${SCRYPT['n']}${SCRYPT['r']}${SCRYPT['p']}${salt.hex()}${digest.hex()}"


def check_password(password: str, stored: str | None) -> bool:
    try:
        scheme, n, r, p, salt, digest = (stored or "").split("$")
        if scheme != "scrypt":
            return False
        got = hashlib.scrypt(password.encode(), salt=bytes.fromhex(salt), dklen=32, n=int(n), r=int(r), p=int(p))
        return hmac.compare_digest(got.hex(), digest)
    except ValueError:
        return False


# A real hash to check against when the account doesn't exist, so a wrong name takes as long as a
# wrong password and response times don't reveal which accounts exist.
_DUMMY_HASH = hash_password(secrets.token_hex(8))


EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
USERNAME_RE = re.compile(r"^[a-z0-9][a-z0-9._-]{2,31}$")


def password_problem(password: str) -> str | None:
    if len(password) < 10:
        return "Use at least 10 characters."
    if len(password) > 200:
        return "Use at most 200 characters."
    return None


def account_problem(email: str, username: str | None, password: str | None) -> str | None:
    """Why a new account can't have these (admin page and python -m app.users), or None."""
    if not EMAIL_RE.match(email):
        return "Enter a valid email."
    if username and not USERNAME_RE.match(username):
        return "Username: 3-32 lowercase letters, digits, dots, dashes or underscores."
    return password_problem(password) if password else None


def insert_account(con, email: str, *, username: str | None = None, name: str | None = None,
                   admin: bool = False, password: str | None = None) -> None:
    """Adds an account in an open connection; sqlite3.IntegrityError when the email or username is taken."""
    con.execute("INSERT INTO users (email, username, name, role, password_hash, created_at) VALUES (?, ?, ?, ?, ?, ?)",
                (email, username, name, "admin" if admin else "member", hash_password(password) if password else None, now()))


def _account_row(con, email: str, name: str | None = None):
    """(id, disabled) of the account with this email; an owner (ADMIN_EMAILS) without one gets it now."""
    row = con.execute("SELECT id, disabled FROM users WHERE email = ?", (email,)).fetchone()
    if not row and email in admin_emails():
        insert_account(con, email, name=name, admin=True)
        row = con.execute("SELECT id, disabled FROM users WHERE email = ?", (email,)).fetchone()
    return row


def _is_token(value: str) -> bool:
    """A session or sign-in-link token: 64 lowercase hex characters (secrets.token_hex(32))."""
    return len(value) == 64 and all(c in "0123456789abcdef" for c in value)


# ---------- Owners and sessions ----------

REMOTE_ACCESS = ("link_or_signin", "signin_only")


_access_cache = {"mode": REMOTE_ACCESS[0], "at": -1e9}
ACCESS_CACHE_SECONDS = 5  # every request asks; a change from the CLI shows within this time


def remote_access() -> str:
    """Admin → Settings → Who gets in: "link_or_signin" (this PC free, others with the lab link or a
    sign-in) or "signin_only" (every device signs in, this PC too)."""
    if time.monotonic() - _access_cache["at"] > ACCESS_CACHE_SECONDS:
        mode = get_setting("remote_access", REMOTE_ACCESS[0])
        _access_cache.update(mode=mode if mode in REMOTE_ACCESS else REMOTE_ACCESS[0], at=time.monotonic())
    return _access_cache["mode"]


def forget_remote_access() -> None:
    """After the admin page changes the setting, so it applies at once."""
    _access_cache["at"] = -1e9


def admin_emails() -> set:
    load_env()
    return {e.strip().lower() for e in os.environ.get("ADMIN_EMAILS", "").split(",") if e.strip()}


def is_admin(user: dict | None) -> bool:
    return bool(user) and (user["role"] == "admin" or user["email"] in admin_emails())


def _sha(text: str) -> str:
    return hashlib.sha256(text.encode()).hexdigest()


def _iso(delta: timedelta = timedelta()) -> str:
    return (datetime.now(timezone.utc) + delta).isoformat(timespec="seconds")


def start_session(request: Request, response, user_id: int) -> None:
    token = secrets.token_hex(32)
    with connect() as con:
        con.execute("INSERT INTO sessions (token_hash, user_id, created_at, expires_at, ip, device) VALUES (?, ?, ?, ?, ?, ?)",
                    (_sha(token), user_id, now(), _iso(timedelta(days=SESSION_DAYS)), client_ip(request), device(request)))
        con.execute("UPDATE users SET last_seen_at = ? WHERE id = ?", (now(), user_id))
        con.execute("DELETE FROM sessions WHERE expires_at <= ?", (now(),))  # tidy up old ones
    prune_log()
    response.set_cookie(SESSION_COOKIE, token, max_age=SESSION_DAYS * 86400, httponly=True,
                        secure=is_https(request), samesite="lax", path="/")


def current_user(request: Request) -> dict | None:
    """The signed-in, enabled user, or None. Expired sessions count as signed out."""
    token = request.cookies.get(SESSION_COOKIE, "")
    if not _is_token(token):
        return None
    with connect() as con:
        row = con.execute(
            "SELECT u.id, u.email, u.username, u.name, u.role FROM sessions s JOIN users u ON u.id = s.user_id"
            " WHERE s.token_hash = ? AND s.expires_at > ? AND u.disabled = 0", (_sha(token), now())).fetchone()
    return dict(row) if row else None


def require_admin(request: Request) -> dict:
    """Route dependency for the admin API: an admin's session, from this PC too (no local bypass)."""
    user = current_user(request)
    if not user:
        raise HTTPException(401, "Sign in first.")
    if not is_admin(user):
        raise HTTPException(403, "This page is for admins.")
    return user


def _redirect(to: str) -> RedirectResponse:
    return RedirectResponse(to, status_code=302, headers={"Cache-Control": "no-store"})


_NEXT = re.compile(r"^/(?!api/|files/|demo|login)[a-z]*(\?[\w\-.=&%]*)?$")


def safe_next(value: str | None) -> str:
    """Only a page of this lab (/admin, /results?set=…), so sign-in can never send someone to another
    site. Old hash links (/#/admin) are accepted as their clean path."""
    if value and value.startswith("/#/"):
        value = value[2:]
    return value if value and len(value) < 200 and _NEXT.match(value) else "/today"


# ---------- OAuth providers ----------

def _http_json(req: urllib.request.Request):
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.load(resp)
    except (urllib.error.URLError, ValueError, TimeoutError):
        return None


def _get(url: str, token: str, **headers):
    return _http_json(urllib.request.Request(url, headers={"Authorization": f"Bearer {token}", "Accept": "application/json", **headers}))


def _google(token: str):
    u = _get("https://openidconnect.googleapis.com/v1/userinfo", token)
    return u and u.get("email") and {"subject": u["sub"], "email": u["email"], "name": u.get("name"),
                                     "verified": u.get("email_verified") is True}


def _github(token: str):
    ua = {"User-Agent": "claim-to-glow"}  # GitHub requires a User-Agent
    u = _get("https://api.github.com/user", token, **ua)
    emails = _get("https://api.github.com/user/emails", token, **ua) or []
    primary = next((e for e in emails if isinstance(e, dict) and e.get("primary") and e.get("verified")), None)
    return u and primary and {"subject": str(u["id"]), "email": primary["email"], "name": u.get("name") or u.get("login"),
                              "verified": True}


def _linkedin(token: str):
    u = _get("https://api.linkedin.com/v2/userinfo", token)
    return u and u.get("email") and {"subject": u["sub"], "email": u["email"], "name": u.get("name"),
                                     "verified": u.get("email_verified") is True}


PROVIDERS = {
    "google": {"authorize": "https://accounts.google.com/o/oauth2/v2/auth", "token": "https://oauth2.googleapis.com/token",
               "scope": "openid email profile", "person": _google},
    "github": {"authorize": "https://github.com/login/oauth/authorize", "token": "https://github.com/login/oauth/access_token",
               "scope": "read:user user:email", "person": _github},
    "linkedin": {"authorize": "https://www.linkedin.com/oauth/v2/authorization", "token": "https://www.linkedin.com/oauth/v2/accessToken",
                 "scope": "openid profile email", "person": _linkedin},
}


def provider_keys(provider: str):
    load_env()
    cid = os.environ.get(f"{provider.upper()}_CLIENT_ID", "")
    secret = os.environ.get(f"{provider.upper()}_CLIENT_SECRET", "")
    return (cid, secret) if cid and secret else None


def methods() -> list:
    """Sign-in methods on offer, in the order the page shows them."""
    return [p for p in PROVIDERS if provider_keys(p)] + (["email"] if can_mail() else []) + ["password"]


def _callback_url(request: Request, provider: str) -> str:
    return f"{origin(request)}/api/auth/callback/{provider}"


@router.get("/api/auth/start")
def oauth_start(request: Request, provider: str, next: str = ""):
    p = PROVIDERS.get(provider)
    keys = p and provider_keys(provider)
    if not p or not keys:
        raise HTTPException(404, "That sign-in method isn't set up.")
    state = secrets.token_urlsafe(24)
    query = urlencode({"client_id": keys[0], "redirect_uri": _callback_url(request, provider), "response_type": "code",
                       "scope": p["scope"], "state": state})
    response = _redirect(f"{p['authorize']}?{query}")
    response.set_cookie(STATE_COOKIE, f"{provider}.{state}.{quote(safe_next(next), safe='')}", max_age=600,
                        httponly=True, secure=is_https(request), samesite="lax", path="/")
    return response


def _fail(request: Request, why: str, provider: str, email: str | None = None) -> RedirectResponse:
    log_access("sign-in", email=email, method=provider[:20], ip=client_ip(request), device=device(request), ok=False, detail=why)
    response = _redirect(f"/login?error={why}")
    response.delete_cookie(STATE_COOKIE, path="/")
    return response


@router.get("/api/auth/callback/{provider}")
def oauth_callback(request: Request, provider: str, code: str = "", state: str = "", error: str = ""):
    p = PROVIDERS.get(provider)
    keys = p and provider_keys(provider)
    if not p or not keys:
        return _fail(request, "unavailable", provider)
    if error:
        return _fail(request, "cancelled", provider)  # said no at the provider
    cp, _, rest = request.cookies.get(STATE_COOKIE, "").partition(".")
    cs, _, cn = rest.partition(".")
    if not code or cp != provider or not cs or not hmac.compare_digest(cs, state):
        return _fail(request, "expired", provider)

    form = urlencode({"grant_type": "authorization_code", "code": code, "redirect_uri": _callback_url(request, provider),
                      "client_id": keys[0], "client_secret": keys[1]}).encode()
    token = _http_json(urllib.request.Request(p["token"], data=form, method="POST", headers={
        "Content-Type": "application/x-www-form-urlencoded", "Accept": "application/json"}))
    try:
        person = p["person"](token["access_token"]) if isinstance(token, dict) and token.get("access_token") else None
    except (KeyError, TypeError, AttributeError):  # a reply without the fields we need
        person = None
    if not person:
        return _fail(request, "provider", provider)
    email = person["email"].strip().lower()
    if not person["verified"]:
        return _fail(request, "unverified", provider, email)

    with connect() as con:
        row = con.execute("SELECT u.id, u.disabled FROM identities i JOIN users u ON u.id = i.user_id"
                          " WHERE i.provider = ? AND i.subject = ?", (provider, person["subject"])).fetchone()
        if not row:
            row = _account_row(con, email, (person.get("name") or "")[:100] or None)
        if row and not row["disabled"]:
            con.execute("INSERT OR IGNORE INTO identities (provider, subject, user_id) VALUES (?, ?, ?)",
                        (provider, person["subject"], row["id"]))
    if not row:
        return _fail(request, "not_invited", provider, email)
    if row["disabled"]:
        return _fail(request, "disabled", provider, email)

    response = _redirect(safe_next(unquote(cn)))
    response.delete_cookie(STATE_COOKIE, path="/")
    start_session(request, response, row["id"])
    log_access("sign-in", email=email, method=provider, ip=client_ip(request), device=device(request))
    return response


# ---------- Password sign-in ----------

class PasswordLogin(BaseModel):
    login: str = Field(max_length=200)  # username or email
    password: str = Field(max_length=200)


def _too_many_fails(ip: str, login: str) -> bool:
    since = _iso(-FAIL_WINDOW)
    with connect() as con:
        by_ip = con.execute("SELECT COUNT(*) FROM access_log WHERE event = 'sign-in' AND ok = 0 AND method = 'password'"
                            " AND ip = ? AND at > ?", (ip, since)).fetchone()[0]
        by_login = con.execute("SELECT COUNT(*) FROM access_log WHERE event = 'sign-in' AND ok = 0 AND method = 'password'"
                               " AND email = ? AND at > ?", (login, since)).fetchone()[0]
    return by_ip >= FAILS_PER_IP or by_login >= FAILS_PER_LOGIN


@router.post("/api/auth/password")
def password_login(body: PasswordLogin, request: Request):
    if not same_site(request):
        raise HTTPException(403, "Sign in from the lab page.")
    login = body.login.strip().lower()[:200]
    ip, dev = client_ip(request), device(request)
    if _too_many_fails(ip, login):
        raise HTTPException(429, "Too many wrong tries. Wait 15 minutes and try again.")
    with connect() as con:
        row = con.execute("SELECT id, email, password_hash, disabled FROM users WHERE email = ? OR lower(username) = ?",
                          (login, login)).fetchone()
    ok = check_password(body.password, row["password_hash"] if row and row["password_hash"] else _DUMMY_HASH) and bool(row)
    if not ok or row["disabled"]:
        log_access("sign-in", email=login, method="password", ip=ip, device=dev, ok=False,
                   detail="disabled" if ok else "wrong name or password")
        raise HTTPException(401, "Wrong username, email or password." if not ok else "This account is turned off.")
    response = JSONResponse({"signed_in": True}, headers={"Cache-Control": "no-store"})
    start_session(request, response, row["id"])
    log_access("sign-in", email=row["email"], method="password", ip=ip, device=dev)
    return response


# ---------- Email link ----------

class EmailLink(BaseModel):
    email: str = Field(max_length=200)
    next: str = Field("", max_length=200)


class LinkToken(BaseModel):
    token: str = Field(max_length=100)


@router.post("/api/auth/email", status_code=204)
def email_link(body: EmailLink, request: Request):
    if not same_site(request):
        raise HTTPException(403, "Sign in from the lab page.")
    if not can_mail():
        raise HTTPException(503, "Email sign-in isn't set up.")
    email = body.email.strip().lower()
    if not EMAIL_RE.match(email):
        raise HTTPException(400, "Enter your email address.")
    ip, dev = client_ip(request), device(request)
    with connect() as con:
        sent_lately = con.execute("SELECT COUNT(*) FROM login_links WHERE created_at > ?", (_iso(-timedelta(hours=1)),)).fetchone()[0]
        recent = con.execute("SELECT 1 FROM login_links WHERE email = ? AND created_at > ?", (email, _iso(-timedelta(minutes=1)))).fetchone()
        con.execute("DELETE FROM login_links WHERE expires_at <= ?", (now(),))
    if sent_lately >= LINKS_PER_HOUR:
        raise HTTPException(429, "Too many sign-in emails right now. Try again in an hour.")
    with connect() as con:
        known = con.execute("SELECT disabled FROM users WHERE email = ?", (email,)).fetchone()
    invited = (known and not known["disabled"]) or email in admin_emails()
    # Same reply whether or not the email has an account, so the form can't be used to find accounts.
    if recent or not invited:
        if not invited:
            log_access("sign-in", email=email, method="email", ip=ip, device=dev, ok=False, detail="link asked, not invited")
        return None
    token = secrets.token_hex(32)
    with connect() as con:
        con.execute("INSERT INTO login_links (token_hash, email, created_at, expires_at) VALUES (?, ?, ?, ?)",
                    (_sha(token), email, now(), _iso(timedelta(minutes=LINK_MINUTES))))
    # The phone-reachable address when the tunnel is set, so the link works from any device.
    base = public_url() or origin(request)
    link = f"{base}/login?{urlencode({'code': token, 'next': safe_next(body.next)})}"
    sent = send_mail(email, "Your Claim to Glow sign-in link",
                     f"Open this link to sign in to Claim to Glow. It works once, for {LINK_MINUTES} minutes:\n\n{link}\n\n"
                     "If you didn't ask for it, ignore this email: nothing happens without the link.")
    log_access("sign-in", email=email, method="email", ip=ip, device=dev, ok=sent, detail="link sent" if sent else "email failed")
    if not sent:
        raise HTTPException(503, "Couldn't send the email. Try again, or use another way to sign in.")
    return None


@router.post("/api/auth/email-verify")
def email_verify(body: LinkToken, request: Request):
    if not same_site(request):
        raise HTTPException(403, "Sign in from the lab page.")
    if not _is_token(body.token):
        raise HTTPException(400, "That sign-in link is broken. Ask for a new one.")
    with connect() as con:
        row = con.execute("SELECT email FROM login_links WHERE token_hash = ? AND expires_at > ?", (_sha(body.token), now())).fetchone()
        con.execute("DELETE FROM login_links WHERE token_hash = ?", (_sha(body.token),))  # one use only
    ip, dev = client_ip(request), device(request)
    if not row:
        log_access("sign-in", method="email", ip=ip, device=dev, ok=False, detail="link used or expired")
        raise HTTPException(410, "This sign-in link was already used or has expired. Ask for a new one.")
    with connect() as con:
        account = _account_row(con, row["email"])
    if not account or account["disabled"]:
        log_access("sign-in", email=row["email"], method="email", ip=ip, device=dev, ok=False, detail="disabled" if account else "not invited")
        raise HTTPException(403, "This account is turned off. Ask an admin." if account else "This account isn't invited.")
    response = JSONResponse({"signed_in": True}, headers={"Cache-Control": "no-store"})
    start_session(request, response, account["id"])
    log_access("sign-in", email=row["email"], method="email", ip=ip, device=dev)
    return response


@router.post("/api/auth/logout")
def logout(request: Request):
    if not same_site(request):
        raise HTTPException(403, "Sign out from the lab page.")
    user = current_user(request)
    token = request.cookies.get(SESSION_COOKIE, "")
    if token:
        with connect() as con:
            con.execute("DELETE FROM sessions WHERE token_hash = ?", (_sha(token),))
    if user:
        log_access("sign-out", email=user["email"], ip=client_ip(request), device=device(request))
    response = JSONResponse({"signed_in": False}, headers={"Cache-Control": "no-store"})
    response.delete_cookie(SESSION_COOKIE, path="/")
    return response


@router.get("/api/me")
def me(request: Request):
    user = current_user(request)
    return JSONResponse({
        "user": user and {"email": user["email"], "username": user["username"], "name": user["name"], "admin": is_admin(user)},
        "methods": methods(),
        "lab_links": remote_access() == "link_or_signin",  # the sign-in page also takes a pasted lab link
        "public_url": public_url(),  # for the sign-in page's "on your phone" QR code (an address, no secret)
    }, headers={"Cache-Control": "no-store"})
