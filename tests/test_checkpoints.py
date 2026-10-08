"""Checkpoint days and photo names. Run: .venv/Scripts/python -m unittest discover tests"""

import unittest

from app.trials import day_stems, is_checkpoint, today_photos

TRIAL = {"duration_days": 21}


class CheckpointTest(unittest.TestCase):
    def test_checkpoint_days(self):
        self.assertEqual([d for d in range(0, 23) if is_checkpoint(TRIAL, d)], [7, 14, 21])
        self.assertTrue(is_checkpoint({"duration_days": 10}, 10))  # the last day always counts

    def test_names(self):
        self.assertEqual(day_stems(TRIAL, 8), ["day-08"])
        self.assertEqual(day_stems(TRIAL, 7), ["day-07", "day-07b", "day-07c"])

    def test_today_progress(self):
        self.assertEqual(today_photos(TRIAL, 7, set()), {"count": 0, "target": 3, "next": "day-07"})
        self.assertEqual(today_photos(TRIAL, 7, {"day-07"}), {"count": 1, "target": 3, "next": "day-07b"})
        # A retaken middle photo is filled first.
        self.assertEqual(today_photos(TRIAL, 7, {"day-07", "day-07c"})["next"], "day-07b")
        self.assertEqual(today_photos(TRIAL, 7, {"day-07", "day-07b", "day-07c"})["next"], None)
        self.assertEqual(today_photos(TRIAL, 8, {"day-08"}), {"count": 1, "target": 1, "next": None})


if __name__ == "__main__":
    unittest.main()
