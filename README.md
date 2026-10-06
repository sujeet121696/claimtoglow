# Claim to Glow

**Every skincare claim, put to the test.**

Skincare brands promise "visible results in 14 days" and prove it with before/after photos taken
under different light, angles and filters. Claim to Glow checks the claim on your own skin:

1. **Claim in:** an agent turns the marketing claim into measurable skin metrics and a deadline.
2. **Fair check-ins:** each photo is gated on lighting, framing and pose so it matches day 0.
3. **Measurement:** YouCam Skin Analysis scores every check-in.
4. **Honest verdict:** only changes bigger than the measured noise floor count. The result is
   "claim met", "not met" or "not enough evidence".
5. **Receipt:** a public result page with a fingerprint of every photo, so it can't be quietly edited.

## Why it's different

| | Skin-scanner apps | Research-grading sites | Photo diaries | **Claim to Glow** |
|---|---|---|---|---|
| Starts from a product claim | – | ✓ | – | ✓ |
| Measures *your* skin | ✓ | – | – | ✓ |
| Separates real change from noise | – | – | – | ✓ |
| Blocks unfair photos | – | – | Partly | ✓ |
| Tamper-evident result | – | – | – | ✓ |

Skin apps tell you your score. Claim to Glow tells you whether the product kept its promise, and
only when the evidence is strong enough to say so.

> Built for the **YouCam API Skin AI & eCommerce VTO Hackathon** by Perfect Corp.
> Status: **early build** (capture lab and noise test). Deadline: Nov 2, 2026.

## Run locally

```sh
cp .env.example .env                      # add your YouCam API key
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt   # macOS/Linux: .venv/bin/pip
.venv/Scripts/python -m uvicorn app.main:app --port 8000

cd web && npm install                     # also fetches the MediaPipe model
npm run dev                               # http://localhost:5173 (laptop camera)
npm run dev:phone                         # https://<pc-ip>:5173 for a phone on the same Wi-Fi
```

The lab app has three screens:

- **Capture:** live camera with the capture gate. The shutter works only when every check passes.
  Auto-capture beeps a countdown for a phone on a stand.
- **Upload:** runs the same gate on photos from the phone's camera app.
- **Results:** analyse a set with YouCam, compare scores and changes against the noise floor.

Photos go to `photos/<set>/` and results to `results/`. Both stay out of git.

## Noise test

Before trusting any "−18%", measure how much scores move when nothing changed:

```sh
.venv/Scripts/python scripts/noise_test.py photos/noise-01 --limit 1   # one photo first
.venv/Scripts/python scripts/noise_test.py photos/noise-01             # the full set (~10 photos)
.venv/Scripts/python scripts/noise_test.py photos/noise-01 --split     # split-face halves
```

See [`docs/TASKS.md`](docs/TASKS.md) for how to take the photos.

## Docs

| File | Contents |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Problem, goals, scope, constraints, risks |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Pipeline, YouCam API facts, modules |
| [`docs/RULES.md`](docs/RULES.md) | Coding and workflow rules |
| [`docs/DESIGN.md`](docs/DESIGN.md) | UI/UX direction |
| [`docs/TASKS.md`](docs/TASKS.md) | Build checklist and progress |

## License

MIT
