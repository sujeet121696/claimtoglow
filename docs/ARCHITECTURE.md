# Architecture

> How Claim to Glow is built: pipeline, YouCam API facts, modules.

## 1. Pipeline

```
Claim text ──▶ [1] Claim agent (LLM) ──▶ { concerns[], deadline_days }
                                                  │
Photo ──▶ [2] Capture gate ──(pass)──▶ [3] YouCam Skin Analysis ──▶ raw scores
            │ (fail: retake)                                           │
                                                                       ▼
                        [4] Noise floor (from repeat-photo test) ──▶ [5] Verdict engine
                                                                       │
                                                                       ▼
                                                    [6] Receipt page + badge snippet
```

## 2. YouCam Skin Analysis facts

Source: https://docs.makeupar.com/reference/ai_skin_analysis (checked Sep 27, 2026).

| Item | Value |
|---|---|
| Base URL | `https://yce-api-01.makeupar.com/s2s/v2.0` (India region) |
| Auth | `Authorization: Bearer <API key>`. One key per teammate: sets `trial-<person>` / `noise-<person>` use `YOUCAM_API_<PERSON>_KEY` when set, else `YOUCAM_API_KEY` (`app/config.py`) |
| Upload | `POST /file` → `file_id` + pre-signed `PUT` URL, then upload the bytes |
| Create task | `POST /task/skin-analysis` with `src_file_id`, `dst_actions[]`, `format: "json"` |
| Poll | `GET /task/skin-analysis/{task_id}` → `task_status`: `running` / `success` / `error` |
| Output | `results.output[]` of `{ type, ui_score, raw_score, mask_urls }` |
| Billing | 14 units per SD analysis with 10 concerns (Oct 6 console); only on `success`. Same photo re-analysed gives identical scores |
| Retention | Results kept 24 hours, so store them locally |

**Observed Oct 6 (2 faces):** `raw_score` is 1–100 and higher is better for every concern (YouCam
docs, checked Oct 7: "A higher score indicates healthier and more aesthetically pleasing skin
condition"). It
differs a lot from `ui_score` (moisture 48 raw vs 69 ui). A face that measured 55% wide by
MediaPipe landmarks was accepted, so YouCam's "60%" uses a wider face box. Rejected tasks cost
no units.

**Use `raw_score`, not `ui_score`.** The docs call `ui_score` "psychologically adjusted": it's
tuned to look nice to users, not to measure change.

**SD vs HD** (can't mix in one task)

| | Min short side | Concerns |
|---|---|---|
| SD | 480 px | `wrinkle`, `acne`, `age_spot`, `redness`, `radiance`, `texture`, `pore`, `moisture`, `oiliness`, `dark_circle_v2`, `eye_bag`, `firmness`, `skin_type`, … |
| HD | 1080 px | Same set with an `hd_` prefix (e.g. `hd_age_spot`) |

**Photo requirements:** face 60–80% of image width, bright even light, front-facing, neutral
expression, mouth closed, eyes open. Errors to handle: `error_src_face_too_small`,
`error_src_face_out_of_bound`, `error_lighting_dark`, `error_below_min_image_size`.

## 3. Stack

| Layer | Choice |
|---|---|
| Skin analysis | YouCam Skin Analysis API |
| Claim agent | `app/llm.py`: free-tier providers tried in order with fallback: Groq → Gemini → NVIDIA → Anthropic (only with a key). Stdlib HTTP, JSON replies |
| Capture gate | In-browser checks: MediaPipe face landmarks (`@mediapipe/tasks-vision`) + pixel brightness |
| Backend | Python + FastAPI (`app/`), same as Ringproof. Photos and results on local disk |
| Web app | React + Vite + TypeScript (`web/`), same as Ringproof |
| Noise test | `scripts/noise_test.py`, shares `app/` modules and the results cache with the web app |
| Hosting | The lab PC. Wi-Fi: Vite dev server (`npm run dev:phone`). Anywhere: Cloudflare Tunnel to FastAPI, which also serves the built app (`web/dist`), behind Cloudflare Access |

**Decided Oct 6:** same stack as Ringproof, so the provider layer and dashboard patterns carry over.
**Decided Oct 7:** Cloudflare Tunnel, not a cloud server, until the agent phase (VISION D10).

## Layout

```
app/       FastAPI: youcam.py (client), analyzer.py (cache, split halves), noise.py,
           verdict.py (pure verdict rule), llm.py (providers), claim.py (claim agent),
           masking.py (background-free copies), trials.py (people, trial.json, day numbering,
           retake, data for the verdict), main.py (API)
web/src/   app/        shell, hash router (#/page?key=value), store (people, selected person)
           api/        typed client, one function per endpoint (future agent tools, VISION D1)
           domain/     trial rules: kinds, set names, labels, concerns (mirrors app/trials.py)
           lib/        gate.ts (capture checks), landmarker, segmenter (person mask),
                       gate and mask backfill, lab token, storage, beep
           components/ PageHeader, Card, Segmented, Field, Badge, ChecksList
           features/   today, people, capture (Camera), upload (Uploader), results
           styles/     tokens.css (colours, spacing), base.css, components.css
web/dist/  built app (npm run build), served by FastAPI at /. Git-ignored
scripts/   noise_test.py (CLI)
tests/     unittest: verdict rule, claim agent and provider fallback (no network)
photos/    <set>/<stem>.jpg + <stem>.meta.json (gate result, SHA-256). Git-ignored
           <set>/_mask/<stem>.png (person mask) + <stem>.jpg (room replaced by flat grey)
           trial-<person>/trial.json: product, claim, claimed concerns, treated side, day 0, length.
           trial-<person>: daily photos day-NN, NN = days since day 0 (gaps stay gaps);
           noise-<person>: repeat photos shot-NN. Both matched against trial-<person>/day-00.
           _retired/: photos moved aside by Retake, with their analyses, and scores left under a
           name when a new photo is saved as it. Nothing is deleted
results/   <set>/<stem>.json, <set>-split/<stem>-L.json. Git-ignored
```

## 4. Modules

| Module | Input | Output | Status |
|---|---|---|---|
| Claim agent | Claim text + product | `{ concerns[], deadline_days, rationale, model }`, concerns checked against the allowed list | `app/claim.py`, `POST /api/claims/parse`; "Suggest from claim" in Person → Edit, a person confirms |
| Capture gate | Camera frame or photo + day-0 reference | pass/fail per check + hint | `web/src/gate.ts`; thresholds untuned |
| Analyzer | Accepted photo | `{ concern: raw_score }`, cached locally | `app/analyzer.py` |
| Noise floor | Repeat-photo scores | Per-concern floor (2√2 × SD) | `app/noise.py` |
| Verdict engine | Claimed concerns, T − C per photo (baseline, checkpoint, repeats) | met / not met / not enough evidence, per-concern effect and floor | `app/verdict.py` + `trial_verdict` in `app/trials.py`; shown on Today; `GET /api/people/{person}/verdict` |
| Receipt | Everything above + photo SHA-256 hashes | Public page + badge snippet | Hashes stored; page not started |

**Access:** `/api` and `/files` answer this PC freely; the app shell is public. Any other device
needs the lab token as a cookie, set by opening the link from Today → "Open on phone" (QR or Copy
link): **Same Wi-Fi** (LAN URL, via Vite) or **Anywhere** (`PUBLIC_URL`, via the tunnel). The token
comes from `LAB_TOKEN` in `.env`, else is generated once into `.lab_token` (git-ignored).
- Wi-Fi: Vite's proxy forwards the real client address (`xfwd`); the API trusts only the last entry.
- Tunnel: `cloudflared` connects from localhost, so any request with `Cf-Connecting-IP` counts as
  remote. Cloudflare Access (team emails only) is the outer lock, the token the inner one.
- The app sends the token to `POST /api/unlock` (open path), which checks it and sets the cookie
  itself (HttpOnly, SameSite=Lax; phone browsers didn't keep a script-set cookie). The lock screen
  says why (no token vs wrong token) and accepts a pasted lab link.
- `/api` and `/files` responses carry `Cache-Control: private, no-store`, so Cloudflare never
  caches faces or scores.
- Other devices only get background-free copies (`_mask/`); originals answer 403 off the PC.
  Masks are made in the browser (MediaPipe selfie segmenter, CPU) right after each capture or
  upload, and by the lab PC for any photo still without one. The API refuses an empty mask (<5% person). YouCam still analyses the originals: on Oct 7, blanked
  copies shifted radiance by +1.9 and +3.7 (0.6–1.2 noise SD, same direction), so mixing the two
  would fake a change. Results offers View and Download per photo, of that same background-free copy.

**Capture gate checks:** one face; face width 55–78% of the image; whole face in frame; nose on
the centre line (±3%, needed for the split); yaw/roll; chin level; neutral face (blendshapes);
brightness and glare; even light on both halves (≤10%); short side ≥ 480 px; and, once day 0
exists, the same camera (image size) and an optional match to day 0 (distance, position, chin,
brightness, light side): shown and recorded, but it doesn't block the photo (Oct 7: matched repeat
photos still differed from day 0, so checkpoints average 3 photos instead). The camera page picks day 0's camera automatically, starts by itself
once permitted (a newer start, e.g. a tap on Start camera, replaces an older one instead of failing), keeps the screen awake, and auto-captures by default on phones. A check must fail
for 0.4 s before the countdown restarts (landmark jitter), and a photo is only taken on a passing frame. Landscape cameras are cropped to 3:4.

## 5. Verdict rule (draft)

**Split-face.** Each photo is split at the image centre into two synthetic faces, each half joined
to its own mirror: T (treated side) and C (control side). Each is analysed separately. Per concern,
the effect is `(T_latest − T_day0) − (C_latest − C_day0)`: change on the treated side beyond what
the control side did anyway.

For each claimed concern, the effect counts only if `|effect| > noise_floor[concern]`, where
`noise_floor` is 2 × √2 × the standard deviation of `T − C` in the repeat-photo test
(`noise_test.py --split`). The √2 is there because the effect compares two photos, day 0 and
latest, and each carries its own noise. If YouCam rejects mirrored faces, fall back to whole-face
`latest − day0` with the whole-face SD. The claim is **met** if every claimed concern moved the claimed way beyond its floor by the deadline, **not met** if a concern
moved the wrong way or stayed within the floor, and **not enough evidence** if check-ins are
missing.

**Averaging (decided Oct 7 from the first noise test):** a checkpoint is the mean of k fresh photos.
Comparing a mean of k photos with a mean of k0 baseline photos, the floor becomes
2 × SD × √(1/k + 1/k0); with k = 3 and k0 = 6 that is 1.41 × SD instead of 2.83 × SD. Within-sitting
SD understates day-to-day noise, so light and time of day must be fixed (see TASKS.md noise results).
Checkpoint days are every 7th day and the last day; the lab names their photos `day-07`, `day-07b`,
`day-07c` (`today_photos` in `app/trials.py`) and the verdict takes all photos of the latest day.

**Direction (confirmed Oct 7, YouCam docs):** a higher `raw_score` is better for every concern, so
"moved the claimed way" means up. The UI marks every score column ↑ and colours a change ▲ better /
▼ worse only beyond the floor; inside it reads "no clear change".
