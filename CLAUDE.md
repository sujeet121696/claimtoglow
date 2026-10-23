# Claim to Glow

Puts skincare claims on trial. It takes a product's claim ("dark spots fade in 14 days"), runs
consistent photo check-ins through YouCam Skin Analysis, and reports whether the claim held,
counting only changes bigger than the measurement noise.

## Snapshot

| | |
|---|---|
| Hackathon | YouCam API Skin AI & eCommerce VTO Hackathon (Perfect Corp, Devpost) |
| Deadline | Nov 2, 2026, 11:45 am ET |
| Team | Sujeet, Sahni and Suvaani (all on the Devpost team; one trial and YouCam key each); eligible for Women in Tech |
| Target | **Submit by Oct 31** (moved from Oct 26 on Oct 23), with the day-21 verdict (Oct 28) in it. Alongside Ringproof (Nebius, Oct 30) |
| Status | Trials running since Oct 7, 21 days (checkpoints Oct 14, 21, 28). Lab, gate, noise test, verdict engine, claim agent, hosting, 3-photo checkpoints, gate check, timeline, receipt and judge demo (claimtoglow.kharidwise.com/demo/) done (Oct 8–9). Calendar reminders, sign-in (Google, GitHub, LinkedIn, email link, password) and admin page (Oct 11). Next: social post, checkpoints, video |

## Stack

Python + FastAPI (`app/`), React + Vite + TypeScript (`web/`). Run instructions in README.md.

## Docs

| File | Contents |
|---|---|
| [docs/PRD.md](docs/PRD.md) | Problem, goals, scope, constraints, risks |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) | Pipeline, YouCam API facts, modules |
| [docs/RULES.md](docs/RULES.md) | Coding and workflow rules |
| [docs/DESIGN.md](docs/DESIGN.md) | UI/UX direction |
| [docs/TASKS.md](docs/TASKS.md) | Build checklist and progress |
| [docs/DEVPOST.md](docs/DEVPOST.md) | Devpost submission text |
| [docs/VISION.md](docs/VISION.md) | Post-hackathon AI agent, scaling decisions (D1–D10), phases |

## Working agreements

- Never commit or push. The user commits manually.
- Follow [docs/RULES.md](docs/RULES.md): verdict math only in `app/verdict.py`, no faces or secrets
  outside the lab, no billed YouCam analysis without asking, tests + `tsc` pass before handing back.
- Keep docs lean, and update the relevant doc whenever scope, stack or tasks change.
