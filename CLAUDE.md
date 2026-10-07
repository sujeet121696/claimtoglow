# Claim to Glow

Puts skincare claims on trial. It takes a product's claim ("dark spots fade in 14 days"), runs
consistent photo check-ins through YouCam Skin Analysis, and reports whether the claim held,
counting only changes bigger than the measurement noise.

## Snapshot

| | |
|---|---|
| Hackathon | YouCam API Skin AI & eCommerce VTO Hackathon (Perfect Corp, Devpost) |
| Deadline | Nov 2, 2026, 11:45 am ET |
| Team | Sujeet, Sahni and Suvaani (one trial each, own YouCam key each); eligible for Women in Tech |
| Priority | Second to Ringproof (Nebius, Oct 30). Light work until Oct 29, full build Oct 30 – Nov 2 |
| Status | Trials running since Oct 7 (lab, capture gate, noise test done; verdict engine next) |

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
| [docs/VISION.md](docs/VISION.md) | Post-hackathon AI agent, scaling decisions (D1–D10), phases |

## Working agreements

- Never commit or push. The user commits manually.
- Keep docs lean, and update the relevant doc whenever scope, stack or tasks change.
