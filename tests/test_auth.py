"""Sign-in rules: password hashing, safe redirects, the wrong-password limit, admin checks."""

import re
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from app import auth, db


class TempDB(unittest.TestCase):
    """Each test gets its own throwaway lab.db."""

    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.patches = [mock.patch.object(db, "DB_PATH", Path(self.tmp.name) / "test.db"),
                        mock.patch.object(db, "_ready", False)]
        for p in self.patches:
            p.start()

    def tearDown(self):
        for p in self.patches:
            p.stop()
        self.tmp.cleanup()


class AuthTest(TempDB):
    def test_password_hash_round_trip(self):
        stored = auth.hash_password("correct horse battery")
        self.assertTrue(stored.startswith("scrypt$"))
        self.assertNotIn("correct horse", stored)
        self.assertTrue(auth.check_password("correct horse battery", stored))
        self.assertFalse(auth.check_password("wrong password!", stored))
        self.assertFalse(auth.check_password("x", None))
        self.assertFalse(auth.check_password("x", "garbage"))

    def test_same_password_hashes_differently(self):
        self.assertNotEqual(auth.hash_password("same password 1"), auth.hash_password("same password 1"))

    def test_password_rules(self):
        self.assertIsNotNone(auth.password_problem("short"))
        self.assertIsNone(auth.password_problem("long enough pw"))

    def test_safe_next_only_allows_lab_pages(self):
        self.assertEqual(auth.safe_next("/admin"), "/admin")
        self.assertEqual(auth.safe_next("/results?set=trial-sahni"), "/results?set=trial-sahni")
        self.assertEqual(auth.safe_next("/#/admin"), "/admin")  # an old hash link
        for bad in ("https://evil.example", "//evil.example", "/#//evil.example", "/\\evil.example", "", None,
                    "/api/me", "/files/photos/x.jpg", "/demo/", "/login", "/admin@evil.example"):
            self.assertEqual(auth.safe_next(bad), "/today", bad)

    def test_wrong_password_limit(self):
        for _ in range(auth.FAILS_PER_LOGIN):
            self.assertFalse(auth._too_many_fails("1.2.3.4", "sam"))
            db.log_access("sign-in", email="sam", method="password", ip="5.6.7.8", ok=False)
        self.assertTrue(auth._too_many_fails("1.2.3.4", "sam"))  # per account, from any address
        self.assertFalse(auth._too_many_fails("1.2.3.4", "alex"))

    def test_admin_from_role_or_owner_list(self):
        with mock.patch.dict("os.environ", {"ADMIN_EMAILS": "Owner@Example.com"}):
            self.assertTrue(auth.is_admin({"role": "member", "email": "owner@example.com"}))
            self.assertTrue(auth.is_admin({"role": "admin", "email": "a@b.co"}))
            self.assertFalse(auth.is_admin({"role": "member", "email": "a@b.co"}))
            self.assertFalse(auth.is_admin(None))

    def test_settings_round_trip(self):
        self.assertEqual(db.get_setting("x", "default"), "default")
        db.put_setting("x", "1")
        db.put_setting("x", "2")
        self.assertEqual(db.get_setting("x"), "2")


class EmailLinkTest(TempDB):
    """One-time email links, with the mail sending replaced (nothing is sent)."""

    def setUp(self):
        super().setUp()
        self.sent = []
        self.patches += [mock.patch.object(auth, "can_mail", return_value=True),
                         mock.patch.object(auth, "send_mail", side_effect=lambda to, subject, text: self.sent.append((to, text)) or True),
                         mock.patch.object(auth, "public_url", return_value=None),
                         mock.patch.dict("os.environ", {"ADMIN_EMAILS": "owner@example.com"})]
        for p in self.patches[2:]:
            p.start()

    @staticmethod
    def request():
        from starlette.requests import Request
        headers = [(b"host", b"lab.test"), (b"origin", b"https://lab.test"), (b"x-forwarded-proto", b"https"), (b"user-agent", b"test")]
        return Request({"type": "http", "method": "POST", "path": "/", "headers": headers, "client": ("1.2.3.4", 1), "query_string": b""})

    def token(self):
        return re.search(r"code=([0-9a-f]{64})", self.sent[-1][1]).group(1)

    def test_link_signs_in_once(self):
        auth.email_link(auth.EmailLink(email="Owner@Example.com", next="/#/admin"), self.request())
        self.assertEqual(self.sent[-1][0], "owner@example.com")
        self.assertIn("https://lab.test/login?code=", self.sent[-1][1])
        self.assertIn("next=%2Fadmin", self.sent[-1][1])
        token = self.token()
        response = auth.email_verify(auth.LinkToken(token=token), self.request())
        self.assertIn("session=", response.headers["set-cookie"])
        with self.assertRaises(auth.HTTPException) as again:
            auth.email_verify(auth.LinkToken(token=token), self.request())
        self.assertEqual(again.exception.status_code, 410)

    def test_no_mail_for_uninvited(self):
        auth.email_link(auth.EmailLink(email="stranger@example.com"), self.request())
        self.assertEqual(self.sent, [])

    def test_one_link_a_minute(self):
        for _ in range(2):
            auth.email_link(auth.EmailLink(email="owner@example.com"), self.request())
        self.assertEqual(len(self.sent), 1)

    def test_expired_link_refused(self):
        auth.email_link(auth.EmailLink(email="owner@example.com"), self.request())
        with db.connect() as con:
            con.execute("UPDATE login_links SET expires_at = '2000-01-01T00:00:00+00:00'")
        with self.assertRaises(auth.HTTPException) as gone:
            auth.email_verify(auth.LinkToken(token=self.token()), self.request())
        self.assertEqual(gone.exception.status_code, 410)

    def test_cross_site_post_refused(self):
        from starlette.requests import Request
        evil = Request({"type": "http", "method": "POST", "path": "/", "headers": [(b"host", b"lab.test"), (b"origin", b"https://evil.test")],
                        "client": ("1.2.3.4", 1), "query_string": b""})
        with self.assertRaises(auth.HTTPException) as refused:
            auth.email_link(auth.EmailLink(email="owner@example.com"), evil)
        self.assertEqual(refused.exception.status_code, 403)


if __name__ == "__main__":
    unittest.main()
