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
| Capture gate | In-browser checks: brightness, MediaPipe face landmarks for framing and pose |
| Backend | _TBD_ |
| Web app | _TBD_ |
| Noise test | `scripts/noise_test.py` (Python stdlib; Pillow for `--split`) |

## 4. Modules

| Module | Input | Output |
|---|---|---|
| Claim agent | Claim text | `{ concerns[], direction, deadline_days, rationale }` |
| Capture gate | Camera frame + day-0 reference | pass/fail + reason |
| Analyzer | Accepted photo | `{ concern: raw_score }`, cached locally |
| Noise floor | Repeat-photo scores | Per-concern threshold |
| Verdict engine | Day-0 vs latest scores + thresholds + claim | met / not met / not enough evidence |
| Receipt | Everything above + photo SHA-256 hashes | Public page + badge snippet |

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
