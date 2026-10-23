"""Background-free copies: thumbnails, versioned URLs, and how long browsers may keep them."""

import os
import tempfile
import unittest
from pathlib import Path
from unittest import mock

from PIL import Image

from app import main, masking


class MaskingTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.photos = Path(self.tmp.name)
        self.patch = mock.patch.object(masking, "PHOTOS", self.photos)
        self.patch.start()
        folder = self.photos / "trial-test"
        folder.mkdir()
        self.photo = folder / "day-00.jpg"
        Image.new("RGB", (1200, 1600), (200, 150, 120)).save(self.photo)

    def tearDown(self):
        self.patch.stop()
        self.tmp.cleanup()

    def save_mask(self):
        mask = Image.new("L", (300, 400), 0)
        mask.paste(255, (60, 60, 240, 340))
        from io import BytesIO
        buf = BytesIO()
        mask.save(buf, "PNG")
        return masking.save_mask(self.photo, "trial-test", buf.getvalue())

    def test_no_copy_no_urls(self):
        self.assertEqual(masking.masked_urls("trial-test", "day-00"), {"masked_url": None, "thumb_url": None})
        self.assertIsNone(masking.make_thumb("trial-test", "day-00"))

    def test_thumbnail_is_small_and_made_with_the_mask(self):
        out = self.save_mask()
        thumb = masking.mask_files("trial-test", "day-00")[2]
        self.assertTrue(thumb.exists())
        with Image.open(thumb) as t:
            self.assertEqual(t.size, (masking.THUMB_WIDTH, 640))
        self.assertLess(thumb.stat().st_size, out.stat().st_size)

    def test_url_version_changes_when_the_copy_is_rewritten(self):
        out = self.save_mask()
        first = masking.masked_urls("trial-test", "day-00")
        self.assertRegex(first["masked_url"], r"^/files/photos/trial-test/_mask/day-00\.jpg\?v=\w+$")
        self.assertRegex(first["thumb_url"], r"^/files/photos/trial-test/_mask/thumb/day-00\.jpg\?v=\w+$")
        st = out.stat()
        os.utime(out, ns=(st.st_atime_ns, st.st_mtime_ns + 10**9))
        self.assertNotEqual(masking.masked_urls("trial-test", "day-00")["masked_url"], first["masked_url"])
        thumb = masking.make_thumb("trial-test", "day-00")  # the newer copy remakes the thumbnail
        self.assertEqual(thumb.stat().st_mtime_ns, out.stat().st_mtime_ns)


class CacheHeaderTest(unittest.TestCase):
    KEEP = "private, max-age=31536000, immutable"

    def test_versioned_copy_and_thumbnail_are_kept(self):
        for path in ("/files/photos/trial-test/_mask/day-00.jpg", "/files/photos/trial-test/_mask/thumb/day-00.jpg"):
            self.assertEqual(main.private_cache(path, True, 200), self.KEEP, path)

    def test_everything_else_is_not_kept(self):
        for args in (("/files/photos/trial-test/_mask/day-00.jpg", False, 200),  # no version
                     ("/files/photos/trial-test/day-00.jpg", True, 200),  # original
                     ("/files/photos/trial-test/_mask/day-09.jpg", True, 404),  # missing
                     ("/files/photos/trial-test/_mask/day-00.jpg", True, 401),  # locked
                     ("/api/people/_mask/", True, 200)):  # data
            self.assertEqual(main.private_cache(*args), "private, no-store", args)


class AppCacheTest(unittest.TestCase):
    def test_hashed_build_files_are_kept_pages_are_rechecked(self):
        self.assertEqual(main.public_cache("/assets/index-abc123.js", 200), "public, max-age=31536000, immutable")
        self.assertEqual(main.public_cache("/demo/assets/index-abc123.css", 200), "public, max-age=31536000, immutable")
        for path in ("/", "/today", "/demo/", "/demo/index.html", "/favicon.svg", "/assets/missing.js"):
            self.assertEqual(main.public_cache(path, 404 if "missing" in path else 200), "no-cache", path)

if __name__ == "__main__":
    unittest.main()
