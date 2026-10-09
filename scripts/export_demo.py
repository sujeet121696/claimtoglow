"""Export the read-only judge demo as a static site (TASKS 23): real trial data, no faces.

Only needed for a static host: the API already serves the same data live at /demo/data/.

    cd web && npm run build:demo        # the app in demo mode -> web/dist-demo/
    .venv/Scripts/python scripts/export_demo.py

Writes web/dist-demo/data/: people.json, and per person timeline.json, receipt.json, badge.svg.
"""

import json
import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import ROOT  # noqa: E402
from app.demo import demo_people, demo_timeline  # noqa: E402
from app.receipt import badge_svg, receipt  # noqa: E402

DEMO = ROOT / "web" / "dist-demo"


def write(path: Path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    text = data if isinstance(data, str) else json.dumps(data, indent=2, ensure_ascii=False)
    path.write_text(text, encoding="utf-8")


def main():
    if not (DEMO / "index.html").exists():
        sys.exit("Build the demo app first: cd web && npm run build:demo")
    shutil.rmtree(DEMO / "mediapipe", ignore_errors=True)  # camera models: the demo has no camera
    out = DEMO / "data"
    shutil.rmtree(out, ignore_errors=True)  # no stale people left from an earlier export
    index = demo_people()
    for card in index["people"]:
        person = card["person"]
        r = receipt(person)
        write(out / person / "timeline.json", demo_timeline(person))
        write(out / person / "receipt.json", r)
        write(out / person / "badge.svg", badge_svg(r["verdict"]["status"]))
        print(f"{person}: {r['verdict']['status']}, receipt {r['receipt_hash'][:12]}")
    write(out / "people.json", index)
    print(f"Demo ready: {DEMO}")


if __name__ == "__main__":
    main()
