"""Accounts, sessions, one-time email sign-in links, the access log and admin settings, in one SQLite file (lab.db, git-ignored).

Stdlib only. Each call opens its own short connection: FastAPI runs routes on a thread pool, and
SQLite connections must not be shared across threads.
"""

import os
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path

from .config import ROOT

DB_PATH = Path(os.environ.get("LAB_DB") or ROOT / "lab.db")  # LAB_DB: a scratch file for tests

SCHEMA = """
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  username TEXT UNIQUE,
  name TEXT,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
  password_hash TEXT,
  disabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  last_seen_at TEXT
);
CREATE TABLE IF NOT EXISTS identities (
  provider TEXT NOT NULL,
  subject TEXT NOT NULL,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  PRIMARY KEY (provider, subject)
);
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  ip TEXT,
  device TEXT
);
CREATE TABLE IF NOT EXISTS access_log (
  id INTEGER PRIMARY KEY,
  at TEXT NOT NULL,
  event TEXT NOT NULL,
  email TEXT,
  method TEXT,
  ip TEXT,
  device TEXT,
  ok INTEGER NOT NULL DEFAULT 1,
  detail TEXT
);
CREATE INDEX IF NOT EXISTS access_log_at ON access_log (at);
CREATE TABLE IF NOT EXISTS login_links (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
"""


def now() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


_ready = False


@contextmanager
def connect():
    """A connection that commits on success and rolls back on error."""
    global _ready
    con = sqlite3.connect(DB_PATH, timeout=10)
    con.row_factory = sqlite3.Row
    con.execute("PRAGMA foreign_keys = ON")
    try:
        if not _ready:
            con.executescript(SCHEMA)
            _ready = True
        yield con
        con.commit()
    except Exception:
        con.rollback()
        raise
    finally:
        con.close()


def get_setting(key: str, default: str = "") -> str:
    with connect() as con:
        row = con.execute("SELECT value FROM settings WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else default


def put_setting(key: str, value: str) -> None:
    with connect() as con:
        con.execute("INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                    (key, value))


LOG_DAYS = 180


def prune_log() -> None:
    """Drop access-log rows older than LOG_DAYS (called when someone signs in)."""
    with connect() as con:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=LOG_DAYS)).isoformat(timespec="seconds")
        con.execute("DELETE FROM access_log WHERE at < ?", (cutoff,))


def log_access(event: str, *, email: str | None = None, method: str | None = None, ip: str = "",
               device: str = "", ok: bool = True, detail: str | None = None) -> None:
    with connect() as con:
        con.execute("INSERT INTO access_log (at, event, email, method, ip, device, ok, detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                    (now(), event, email, method, ip, device[:200], int(ok), detail))
