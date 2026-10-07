"""Verdict engine on hand-made numbers. Run: .venv/Scripts/python -m unittest discover tests"""

import unittest

from app.verdict import IMPROVED, MET, NO_CHANGE, NOT_ENOUGH, NOT_MET, UNKNOWN, WORSENED, verdict

# Repeat photos with T - C of 9, 10, 11, 10, 10 -> SD = 0.71
NOISE = [{"radiance": v} for v in (9, 10, 11, 10, 10)]
BASE = [{"radiance": 10}] * 6  # k0 = 6
# floor with k = 3, k0 = 6: 2 x 0.71 x sqrt(1/3 + 1/6) = 1.0


def check(*values):
    return [{"radiance": v} for v in values]


class VerdictTest(unittest.TestCase):
    def test_floor_and_effect(self):
        row = verdict(["radiance"], BASE, check(13, 13, 13), NOISE, final=True)["concerns"][0]
        self.assertEqual((row["sd"], row["floor"], row["effect"]), (0.71, 1.0, 3.0))

    def test_improved_is_met(self):
        v = verdict(["radiance"], BASE, check(13, 13, 13), NOISE, final=True)
        self.assertEqual((v["status"], v["concerns"][0]["result"]), (MET, IMPROVED))

    def test_within_floor_at_deadline_is_not_met(self):
        v = verdict(["radiance"], BASE, check(10.5, 10.5, 10.5), NOISE, final=True)
        self.assertEqual((v["status"], v["concerns"][0]["result"]), (NOT_MET, NO_CHANGE))

    def test_within_floor_before_deadline_is_not_enough(self):
        v = verdict(["radiance"], BASE, check(10.5, 10.5, 10.5), NOISE, final=False)
        self.assertEqual(v["status"], NOT_ENOUGH)

    def test_worse_at_deadline_is_not_met(self):
        v = verdict(["radiance"], BASE, check(7, 7, 7), NOISE, final=True)
        self.assertEqual((v["status"], v["concerns"][0]["result"]), (NOT_MET, WORSENED))

    def test_lower_is_better(self):
        v = verdict(["radiance"], BASE, check(7, 7, 7), NOISE, final=True, better={"radiance": "lower"})
        self.assertEqual(v["status"], MET)

    def test_missing_data_is_not_enough(self):
        self.assertEqual(verdict(["radiance"], BASE, [], NOISE, final=True)["status"], NOT_ENOUGH)
        self.assertEqual(verdict(["radiance"], BASE, check(13), NOISE[:4], final=True)["concerns"][0]["result"], UNKNOWN)
        self.assertEqual(verdict([], BASE, check(13), NOISE, final=True)["status"], NOT_ENOUGH)

    def test_every_concern_must_improve(self):
        base = [{"radiance": 10, "texture": 10}] * 6
        noise = [{"radiance": v, "texture": v} for v in (9, 10, 11, 10, 10)]
        checkpoint = [{"radiance": 13, "texture": 10}] * 3
        v = verdict(["radiance", "texture"], base, checkpoint, noise, final=True)
        self.assertEqual(v["status"], NOT_MET)


if __name__ == "__main__":
    unittest.main()
