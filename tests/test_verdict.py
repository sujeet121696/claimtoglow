"""Verdict engine on hand-made numbers. Run: .venv/Scripts/python -m unittest discover tests"""

import math
import unittest

from app.verdict import IMPROVED, MET, NO_CHANGE, NOT_ENOUGH, NOT_MET, UNKNOWN, WORSENED, day_sd, verdict

# Repeat photos with T - C of 9, 10, 11, 10, 10 -> SD = 0.71
NOISE = [{"radiance": v} for v in (9, 10, 11, 10, 10)]
BASE = [{"radiance": 10}] * 6  # k0 = 6
# floor with k = 3, k0 = 6: 2 x 0.71 x sqrt(1/3 + 1/6) = 1.0
DAYS = [{"radiance": 10}] * 4  # steady days: no noise between days on top of the repeat photos


def check(*values):
    return [{"radiance": v} for v in values]


class VerdictTest(unittest.TestCase):
    def test_floor_and_effect(self):
        row = verdict(["radiance"], BASE, check(13, 13, 13), NOISE, DAYS, final=True)["concerns"][0]
        self.assertEqual((row["sd"], row["floor"], row["effect"]), (0.71, 1.0, 3.0))

    def test_improved_is_met(self):
        v = verdict(["radiance"], BASE, check(13, 13, 13), NOISE, DAYS, final=True)
        self.assertEqual((v["status"], v["concerns"][0]["result"]), (MET, IMPROVED))

    def test_within_floor_at_deadline_is_not_met(self):
        v = verdict(["radiance"], BASE, check(10.5, 10.5, 10.5), NOISE, DAYS, final=True)
        self.assertEqual((v["status"], v["concerns"][0]["result"]), (NOT_MET, NO_CHANGE))

    def test_within_floor_before_deadline_is_not_enough(self):
        v = verdict(["radiance"], BASE, check(10.5, 10.5, 10.5), NOISE, DAYS, final=False)
        self.assertEqual(v["status"], NOT_ENOUGH)

    def test_worse_at_deadline_is_not_met(self):
        v = verdict(["radiance"], BASE, check(7, 7, 7), NOISE, DAYS, final=True)
        self.assertEqual((v["status"], v["concerns"][0]["result"]), (NOT_MET, WORSENED))

    def test_lower_is_better(self):
        v = verdict(["radiance"], BASE, check(7, 7, 7), NOISE, DAYS, final=True, better={"radiance": "lower"})
        self.assertEqual(v["status"], MET)

    def test_missing_data_is_not_enough(self):
        self.assertEqual(verdict(["radiance"], BASE, [], NOISE, DAYS, final=True)["status"], NOT_ENOUGH)
        self.assertEqual(verdict(["radiance"], BASE, check(13), NOISE[:4], DAYS, final=True)["concerns"][0]["result"], UNKNOWN)
        self.assertEqual(verdict([], BASE, check(13), NOISE, DAYS, final=True)["status"], NOT_ENOUGH)

    def test_every_concern_must_improve(self):
        base = [{"radiance": 10, "texture": 10}] * 6
        noise = [{"radiance": v, "texture": v} for v in (9, 10, 11, 10, 10)]
        checkpoint = [{"radiance": 13, "texture": 10}] * 3
        days = [{"radiance": 10, "texture": 10}] * 4
        v = verdict(["radiance", "texture"], base, checkpoint, noise, days, final=True)
        self.assertEqual(v["status"], NOT_MET)

    def test_day_sd_from_successive_differences(self):
        # differences 2, -2, 2 -> sqrt(12 / (2 x 3)) = 1.41; a steady climb barely counts as noise
        self.assertAlmostEqual(day_sd([10, 12, 10, 12]), 1.414, places=3)
        self.assertEqual(day_sd([1, 2, 3, 4]), math.sqrt(0.5))

    def test_noise_between_days_widens_the_floor(self):
        # Day-to-day SD 10 swamps the repeat SD 0.71: an effect of 3 is no longer clear
        days = check(0, 20, 0, 20)
        row = verdict(["radiance"], BASE, check(13, 13, 13), NOISE, days, final=True)["concerns"][0]
        self.assertEqual(row["result"], NO_CHANGE)
        self.assertEqual(row["sd_between"], 14.12)
        self.assertGreater(row["floor"], 3)

    def test_too_few_days_is_not_enough(self):
        v = verdict(["radiance"], BASE, check(13, 13, 13), NOISE, DAYS[:3], final=True)
        self.assertEqual((v["status"], v["concerns"][0]["result"]), (NOT_ENOUGH, UNKNOWN))
        self.assertIn("days", v["reason"])


if __name__ == "__main__":
    unittest.main()
