"""Verdict engine (pure, VISION D1): did the treated half change beyond noise, the way the claim says?

Each photo gives the split-face series T - C (treated half minus control half), so light, sleep
and season that hit both halves cancel out. Per claimed concern:

    effect = mean(T - C at the checkpoint) - mean(T - C at baseline)
    floor  = 2 x sqrt(SD_w^2 x (1/k + 1/k0) + 2 x SD_b^2)

SD_w is the noise within one sitting (SD of T - C over the repeat photos); k, k0 = photos at the
checkpoint and at baseline, so more photos shrink it. SD_b is the noise between days (light, time,
setup) that more photos on the same day can't average away, so the checkpoint and the baseline each
carry it once. It comes from the daily photos: a single photo's day-to-day SD is
sqrt(sum of squared day-to-day differences / (2 x (n - 1))), which a slow product effect barely
moves, and SD_b^2 = that^2 - SD_w^2 (at least 0). Measured Oct 13: day-to-day noise was 1.1 to 10x
the within-sitting noise.

The concern improved (or worsened) only when |effect| > floor; otherwise there is no clear change.
Claim: met if every claimed concern improved. At the deadline: not met if any concern worsened or
showed no clear change. Before the deadline, or with photos or noise missing: not enough evidence.
"""

import math
import statistics

MIN_NOISE_PHOTOS = 5  # repeat photos needed for a usable SD (TASKS.md, noise test)
MIN_DAYS = 4  # analysed days needed for a day-to-day SD (3 differences)

MET, NOT_MET, NOT_ENOUGH = "met", "not met", "not enough evidence"
IMPROVED, WORSENED, NO_CHANGE, UNKNOWN = "improved", "worsened", "no clear change", "unknown"


def values(series: list, concern: str) -> list:
    return [s[concern] for s in series if concern in s]


def day_sd(days: list) -> float:
    """A single photo's day-to-day SD from successive differences of a series in day order."""
    diffs = [b - a for a, b in zip(days, days[1:])]
    return math.sqrt(sum(d * d for d in diffs) / (2 * len(diffs)))


def between_sd(sd_w: float, days: list) -> float:
    """Noise between days on top of the within-sitting SD."""
    return math.sqrt(max(0.0, day_sd(days) ** 2 - sd_w ** 2))


def floor_of(sd_w: float, sd_b: float, k: int, k0: int) -> float:
    return 2 * math.sqrt(sd_w ** 2 * (1 / k + 1 / k0) + 2 * sd_b ** 2)


def concern_result(concern: str, baseline: list, checkpoint: list, noise: list, days: list, better: str) -> dict:
    """One concern. Series are lists of {concern: T - C}: one dict per photo, and for `days` one
    per analysed day in day order (the mean of that day's photos)."""
    base, check, rep, day = (values(s, concern) for s in (baseline, checkpoint, noise, days))
    row = {"concern": concern, "better": better, "k0": len(base), "k": len(check), "noise_n": len(rep), "days_n": len(day)}
    if not base or not check or len(rep) < MIN_NOISE_PHOTOS or len(day) < MIN_DAYS:
        return {**row, "result": UNKNOWN}
    sd = statistics.stdev(rep)
    sd_b = between_sd(sd, day)
    effect = statistics.mean(check) - statistics.mean(base)
    floor = floor_of(sd, sd_b, len(check), len(base))
    if abs(effect) <= floor:
        result = NO_CHANGE
    else:
        result = IMPROVED if (effect > 0) == (better == "higher") else WORSENED
    return {**row, "sd": round(sd, 2), "sd_between": round(sd_b, 2), "effect": round(effect, 2), "floor": round(floor, 2), "result": result}


def verdict(concerns: list, baseline: list, checkpoint: list, noise: list, days: list, final: bool,
            better: dict | None = None) -> dict:
    """The claim's verdict. `final` is True once the checkpoint is at or past the deadline.
    `better` maps a concern to "higher" or "lower"; a concern not in it counts as higher-is-better,
    which YouCam's docs state for every raw_score ("A higher score indicates healthier ... skin")."""
    better = better or {}
    rows = [concern_result(c, baseline, checkpoint, noise, days, better.get(c, "higher")) for c in concerns]
    results = {r["result"] for r in rows}

    if not concerns:
        status, reason = NOT_ENOUGH, "No claimed concerns set for this trial."
    elif UNKNOWN in results:
        status = NOT_ENOUGH
        if not baseline or any(r["noise_n"] < MIN_NOISE_PHOTOS for r in rows):
            reason = f"Analyse day 0 and at least {MIN_NOISE_PHOTOS} repeat photos (split) first."
        elif not checkpoint:
            reason = "No checkpoint (day 7, 14, 21) analysed yet."
        elif any(r["days_n"] < MIN_DAYS for r in rows):
            reason = f"Analyse at least {MIN_DAYS} days (split) to measure the noise between days."
        else:
            reason = "Some claimed concerns have no scores."
    elif results == {IMPROVED}:
        status, reason = MET, "Every claimed concern improved beyond the noise floor."
    elif not final:
        status, reason = NOT_ENOUGH, "Deadline not reached yet."
    elif WORSENED in results:
        status, reason = NOT_MET, "A claimed concern got worse beyond the noise floor."
    else:
        status, reason = NOT_MET, "A claimed concern showed no change beyond the noise floor."
    return {"status": status, "reason": reason, "concerns": rows}
