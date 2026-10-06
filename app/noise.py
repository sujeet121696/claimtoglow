"""Noise floor from repeat photos of an unchanged face.

A verdict compares two photos (day 0 and latest), and each carries its own noise, so the change
between them has an SD of sqrt(2) x the per-photo SD. A change counts only beyond 2 x that:
floor = 2 x sqrt(2) x SD. The same holds for split-face, where the per-photo series is L - R.
"""

import math
import statistics

FLOOR_K = 2 * math.sqrt(2)


def noise_row(concern: str, values: list) -> dict:
    sd = statistics.stdev(values)
    return {
        "concern": concern,
        "n": len(values),
        "mean": round(statistics.mean(values), 2),
        "sd": round(sd, 2),
        "min": round(min(values), 2),
        "max": round(max(values), 2),
        "floor": round(FLOOR_K * sd, 2),
    }


def split_pairs(per_image: dict) -> dict:
    """{stem: (L scores, R scores)} from half-face results keyed '<stem>-L' / '<stem>-R'."""
    stems = sorted({s[:-2] for s in per_image if s.endswith(("-L", "-R"))})
    return {s: (per_image[f"{s}-L"], per_image[f"{s}-R"]) for s in stems
            if f"{s}-L" in per_image and f"{s}-R" in per_image}


def noise_rows(per_image: dict, split: bool) -> list:
    """Rows of noise stats per series ('photo', or 'L', 'R', 'L-R') and concern."""
    if split:
        pairs = list(split_pairs(per_image).values())
        series = {
            "L": [l for l, _ in pairs],
            "R": [r for _, r in pairs],
            "L-R": [{c: l[c] - r[c] for c in l if c in r} for l, r in pairs],
        }
    else:
        series = {"photo": list(per_image.values())}

    rows = []
    for name, scores_list in series.items():
        for concern in sorted({c for scores in scores_list for c in scores}):
            values = [s[concern] for s in scores_list if concern in s]
            if len(values) >= 2:
                rows.append({"series": name, **noise_row(concern, values)})
    return rows
