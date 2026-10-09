"""Verdict engine (pure, VISION D1): did the treated half change beyond noise, the way the claim says?

Each photo gives the split-face series T - C (treated half minus control half), so light, sleep
and season that hit both halves cancel out. Per claimed concern:

    effect = mean(T - C at the checkpoint) - mean(T - C at baseline)
    floor  = 2 x SD x sqrt(1/k + 1/k0)      SD of T - C over the repeat photos;
                                             k, k0 = photos at the checkpoint and at baseline

The concern improved (or worsened) only when |effect| > floor; otherwise there is no clear change.
Claim: met if every claimed concern improved. At the deadline: not met if any concern worsened or
showed no clear change. Before the deadline, or with photos or noise missing: not enough evidence.
"""

import math
import statistics

MIN_NOISE_PHOTOS = 5  # repeat photos needed for a usable SD (TASKS.md, noise test)

MET, NOT_MET, NOT_ENOUGH = "met", "not met", "not enough evidence"
IMPROVED, WORSENED, NO_CHANGE, UNKNOWN = "improved", "worsened", "no clear change", "unknown"


def values(series: list, concern: str) -> list:
    return [s[concern] for s in series if concern in s]


def concern_result(concern: str, baseline: list, checkpoint: list, noise: list, better: str) -> dict:
    """One concern. Series are lists of {concern: T - C}, one dict per photo."""
    base, check, rep = values(baseline, concern), values(checkpoint, concern), values(noise, concern)
    row = {"concern": concern, "better": better, "k0": len(base), "k": len(check), "noise_n": len(rep)}
    if not base or not check or len(rep) < MIN_NOISE_PHOTOS:
        return {**row, "result": UNKNOWN}
    sd = statistics.stdev(rep)
    effect = statistics.mean(check) - statistics.mean(base)
    floor = 2 * sd * math.sqrt(1 / len(check) + 1 / len(base))
    if abs(effect) <= floor:
        result = NO_CHANGE
    else:
        result = IMPROVED if (effect > 0) == (better == "higher") else WORSENED
    return {**row, "sd": round(sd, 2), "effect": round(effect, 2), "floor": round(floor, 2), "result": result}


def verdict(concerns: list, baseline: list, checkpoint: list, noise: list, final: bool, better: dict | None = None) -> dict:
    """The claim's verdict. `final` is True once the checkpoint is at or past the deadline.
    `better` maps a concern to "higher" or "lower"; a concern not in it counts as higher-is-better,
    which YouCam's docs state for every raw_score ("A higher score indicates healthier ... skin")."""
    better = better or {}
    rows = [concern_result(c, baseline, checkpoint, noise, better.get(c, "higher")) for c in concerns]
    results = {r["result"] for r in rows}

    if not concerns:
        status, reason = NOT_ENOUGH, "No claimed concerns set for this trial."
    elif UNKNOWN in results:
        status = NOT_ENOUGH
        if not baseline or any(r["noise_n"] < MIN_NOISE_PHOTOS for r in rows):
            reason = f"Analyse day 0 and at least {MIN_NOISE_PHOTOS} repeat photos (split) first."
        elif not checkpoint:
            reason = "No checkpoint (day 7, 14, 21) analysed yet."
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
