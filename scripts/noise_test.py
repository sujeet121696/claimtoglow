#!/usr/bin/env python3
"""Measure how much YouCam Skin Analysis scores move when nothing changed (the noise floor).

Take ~10 photos of the same face in one sitting (same light, same distance, step out of frame
between shots), put them in one folder, then run:

    python scripts/noise_test.py photos/noise-sujeet --limit 1   # one photo first, check unit usage
    python scripts/noise_test.py photos/noise-sujeet             # the full set
    python scripts/noise_test.py photos/noise-sujeet --split     # split-face: each half mirrored

--split builds two synthetic faces per photo, one from the image's left half plus its mirror (L)
and one from the right half (R), split at the image centre, so keep the nose centred in frame.
It reports noise per side and for the L - R difference, which is what a split-face verdict uses.
It needs Pillow (pip install pillow) and costs two analyses per photo.

The floor column is 2 x sqrt(2) x SD: the smallest change between two photos (day 0 vs latest)
that is unlikely to be noise. See app/noise.py.

Every successful analysis costs API units. Results are cached in results/<folder name>/, so
re-running never re-analyses a photo that already has a result. The web app uses the same cache.
"""

import argparse
import csv
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.analyzer import DEFAULT_ACTIONS, analyze_cached, cached_scores, mirror_halves, photo_files, result_dir  # noqa: E402
from app.config import ROOT, key_var_for  # noqa: E402
from app.noise import noise_rows  # noqa: E402
from app.youcam import YouCam  # noqa: E402


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("folder", type=Path, help="Folder of repeat photos of the same face")
    parser.add_argument("--limit", type=int, help="Run at most this many new analyses")
    parser.add_argument("--actions", default=",".join(DEFAULT_ACTIONS), help="Comma-separated SD concerns")
    parser.add_argument("--split", action="store_true", help="Analyse mirrored left and right halves")
    args = parser.parse_args()

    key_var = key_var_for(args.folder.name)
    print(f"Using {key_var}")
    try:
        client = YouCam.from_env(key_var)
    except RuntimeError as e:
        sys.exit(str(e))
    actions = [a.strip() for a in args.actions.split(",") if a.strip()]

    photos = photo_files(args.folder)
    if not photos:
        sys.exit(f"No .jpg/.png photos in {args.folder}")

    out_dir = result_dir(args.folder.name, args.split)
    out_dir.mkdir(parents=True, exist_ok=True)
    if args.split:
        try:
            photos = [half for p in photos for half in mirror_halves(p, out_dir / "images")]
        except ImportError:
            sys.exit("--split needs Pillow: pip install pillow")

    analysed = 0
    for photo in photos:
        if (out_dir / f"{photo.stem}.json").exists():
            continue
        if args.limit is not None and analysed >= args.limit:
            break
        print(f"Analysing {photo.name} ...", flush=True)
        try:
            analyze_cached(client, photo, out_dir, actions)
        except RuntimeError as e:
            print(f"  failed: {e}", file=sys.stderr)
            continue
        analysed += 1
    print(f"Newly analysed: {analysed}. Check units used in the YouCam console.\n")

    rows = noise_rows(cached_scores(out_dir), args.split)
    if not rows:
        print("Need at least 2 analysed photos to measure noise.")
        return

    print(f"{'series':<7}{'concern':<16}{'n':>4}{'mean':>9}{'sd':>8}{'min':>9}{'max':>9}{'floor':>9}")
    for r in rows:
        print(f"{r['series']:<7}{r['concern']:<16}{r['n']:>4}{r['mean']:>9}{r['sd']:>8}"
              f"{r['min']:>9}{r['max']:>9}{r['floor']:>9}")

    summary = out_dir / "noise_summary.csv"
    with summary.open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    print(f"\nSaved {summary.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
