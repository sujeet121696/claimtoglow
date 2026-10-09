"""Receipt fingerprint and badge. Run: .venv/Scripts/python -m unittest discover tests"""

import unittest

from app.receipt import badge_svg, receipt_hash

BODY = {"claim": "brightens", "photos": {"daily": [{"stem": "day-00", "sha256": "ab"}]}}


class ReceiptTest(unittest.TestCase):
    def test_hash_ignores_key_order(self):
        reordered = {"photos": {"daily": [{"sha256": "ab", "stem": "day-00"}]}, "claim": "brightens"}
        self.assertEqual(receipt_hash(BODY), receipt_hash(reordered))

    def test_hash_changes_when_a_photo_changes(self):
        edited = {"claim": "brightens", "photos": {"daily": [{"stem": "day-00", "sha256": "ac"}]}}
        self.assertNotEqual(receipt_hash(BODY), receipt_hash(edited))

    def test_badge_says_the_status(self):
        self.assertIn("claim met", badge_svg("met"))
        self.assertIn("claim not met", badge_svg("not met"))
        self.assertIn("not enough evidence", badge_svg("not enough evidence"))


if __name__ == "__main__":
    unittest.main()
