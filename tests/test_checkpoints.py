"""Checkpoint days and photo names. Run: .venv/Scripts/python -m unittest discover tests"""

import unittest

from app.trials import checkpoint_for, day_stems, is_checkpoint, today_photos

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
        self.assertEqual(today_photos(TRIAL, 22, set())["target"], 0)  # trial finished
        self.assertEqual(today_photos(TRIAL, None, set())["target"], 1)  # no start date: day 0 still needed


class LateCheckpointTest(unittest.TestCase):
    """A missed checkpoint is made up only on a day listed in trial.json `late_checkpoints`."""
    LATE = {**TRIAL, "late_checkpoints": {"16": 14}}

    def test_listed_day_takes_three_photos_for_the_missed_one(self):
        self.assertEqual(checkpoint_for(self.LATE, 16), 14)
        self.assertEqual(day_stems(self.LATE, 16), ["day-16", "day-16b", "day-16c"])
        self.assertEqual(today_photos(self.LATE, 16, {"day-16"}), {"count": 1, "target": 3, "next": "day-16b"})

    def test_nothing_else_changes(self):
        self.assertEqual([d for d in range(0, 23) if is_checkpoint(self.LATE, d)], [7, 14, 16, 21])
        self.assertEqual(day_stems(self.LATE, 17), ["day-17"])
        self.assertIsNone(checkpoint_for(TRIAL, 16))  # no list: planned days only


if __name__ == "__main__":
    unittest.main()
