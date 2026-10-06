# Architecture

> How Claim to Glow is built: pipeline, YouCam API facts, modules.

## 1. Pipeline

```
Claim text ──▶ [1] Claim agent (LLM) ──▶ { concerns[], direction, deadline_days }
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
| Auth | `Authorization: Bearer <API key>` |
| Upload | `POST /file` → `file_id` + pre-signed `PUT` URL, then upload the bytes |
| Create task | `POST /task/skin-analysis` with `src_file_id`, `dst_actions[]`, `format: "json"` |
| Poll | `GET /task/skin-analysis/{task_id}` → `task_status`: `running` / `success` / `error` |
| Output | `results.output[]` of `{ type, ui_score, raw_score, mask_urls }` |
| Billing | Units consumed only on `success` |
| Retention | Results kept 24 hours, so store them locally |

**Observed Oct 6 (2 faces):** `raw_score` is 0–100 and higher looks better (to confirm). It
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
| Claim agent | LLM via a thin provider layer (same pattern as Resolve's `brain.ts` / Ringproof) |
| Capture gate | In-browser checks: MediaPipe face landmarks (`@mediapipe/tasks-vision`) + pixel brightness |
| Backend | Python + FastAPI (`app/`), same as Ringproof. Photos and results on local disk |
| Web app | React + Vite + TypeScript (`web/`), same as Ringproof |
| Noise test | `scripts/noise_test.py`, shares `app/` modules and the results cache with the web app |

**Decided Oct 6:** same stack as Ringproof, so the provider layer and dashboard patterns carry over.

## Layout

```
app/       FastAPI: youcam.py (client), analyzer.py (cache, split halves), noise.py, main.py (API)
web/src/   gate.ts (capture checks), CameraView / UploadView / ResultsView
scripts/   noise_test.py (CLI)
photos/    <set>/<stem>.jpg + <stem>.meta.json (gate result, SHA-256). Git-ignored
results/   <set>/<stem>.json, <set>-split/<stem>-L.json. Git-ignored
```

## 4. Modules

| Module | Input | Output | Status |
|---|---|---|---|
| Claim agent | Claim text | `{ concerns[], direction, deadline_days, rationale }` | Not started |
| Capture gate | Camera frame or photo + day-0 reference | pass/fail per check + hint | `web/src/gate.ts`; thresholds untuned |
| Analyzer | Accepted photo | `{ concern: raw_score }`, cached locally | `app/analyzer.py` |
| Noise floor | Repeat-photo scores | Per-concern floor (2√2 × SD) | `app/noise.py` |
| Verdict engine | Day-0 vs latest scores + thresholds + claim | met / not met / not enough evidence | Not started (Results screen shows Δ vs floor) |
| Receipt | Everything above + photo SHA-256 hashes | Public page + badge snippet | Hashes stored; page not started |

**Capture gate checks:** one face; face width 55–78% of the image; whole face in frame; nose on
the centre line (±3%, needed for the split); yaw/roll; chin level; neutral face (blendshapes);
brightness and glare; even light on both halves (≤10%); short side ≥ 480 px; and, once day 0
exists, a match to day 0 (distance, position, chin, light). Landscape cameras are cropped to 3:4.

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

Which direction is "better" for each concern's `raw_score` must be confirmed from real data
(e.g. does a higher `age_spot` score mean fewer spots?).
