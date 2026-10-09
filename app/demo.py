"""Face-free data for the read-only judge demo (TASKS 23), shared by the live /demo/data routes
and scripts/export_demo.py. Photo links, notes and key names are left out."""

from datetime import date

from .receipt import timeline
from .trials import people, summary


def demo_people() -> dict:
    cards = []
    for person in people():
        card = summary(person)
        card.update({"notes": "", "key_var": "", "day0": None, "latest": None})
        cards.append(card)
    return {"people": cards, "today": date.today().isoformat()}


def demo_timeline(person: str) -> dict:
    t = timeline(person)
    for entry in t["entries"]:
        entry["masked_url"] = None
    return t
