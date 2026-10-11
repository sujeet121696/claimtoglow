"""Create or reset an account from this PC, e.g. the first admin before any Google/GitHub keys exist.

    .venv/Scripts/python -m app.users add you@example.com --username sujeet --admin
    .venv/Scripts/python -m app.users password you@example.com
    .venv/Scripts/python -m app.users allow-links      # undo "Sign-in only" if you're locked out

The password is asked for twice and never shown or stored in plain text.
"""

import argparse
import getpass
import sqlite3
import sys

from .auth import account_problem, hash_password, insert_account, password_problem
from .db import connect, put_setting



def ask_password() -> str:
    while True:
        first = getpass.getpass("Password (10+ characters): ")
        problem = password_problem(first)
        if problem:
            print(problem)
        elif getpass.getpass("Again: ") != first:
            print("They don't match.")
        else:
            return first


def main(argv=None) -> int:
    parser = argparse.ArgumentParser(prog="python -m app.users")
    sub = parser.add_subparsers(dest="command", required=True)
    add = sub.add_parser("add", help="add an account with a password")
    add.add_argument("email")
    add.add_argument("--username")
    add.add_argument("--name")
    add.add_argument("--admin", action="store_true")
    reset = sub.add_parser("password", help="set a new password")
    reset.add_argument("email")
    sub.add_parser("allow-links", help='turn "Sign-in only" off: this PC and lab links work again')
    args = parser.parse_args(argv)

    if args.command == "allow-links":
        put_setting("remote_access", "link_or_signin")
        print("Sign-in only is off: this PC opens the lab, and lab links work again.")
        return 0

    email = args.email.strip().lower()
    with connect() as con:
        exists = con.execute("SELECT id FROM users WHERE email = ?", (email,)).fetchone()
    if args.command == "add":
        username = (args.username or "").strip().lower() or None
        if problem := account_problem(email, username, None):
            print(problem)
            return 1
        if exists:
            print(f"{email} already has an account; use `password` to reset it.")
            return 1
        password = ask_password()
        try:
            with connect() as con:
                insert_account(con, email, username=username, name=args.name, admin=args.admin, password=password)
        except sqlite3.IntegrityError:
            print(f"The username {username} is taken.")
            return 1
        print(f"Added {email}{' as admin' if args.admin else ''}.")
    else:
        if not exists:
            print(f"No account for {email}.")
            return 1
        with connect() as con:
            con.execute("UPDATE users SET password_hash = ? WHERE email = ?", (hash_password(ask_password()), email))
            con.execute("DELETE FROM sessions WHERE user_id = ?", (exists["id"],))  # sign out everywhere
        print(f"New password set for {email}; old sessions signed out.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
