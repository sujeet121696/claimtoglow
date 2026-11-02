# Devpost submission

> Text for the Devpost project page (task 25). Only verified facts. Day-21 results added Oct 30
> (from `trial_verdict`, cached results; all three YouCam keys were out of credits by then).
> Devpost does not render LaTeX in the story here, so the formula is a plain code block.

## Project overview

- **Name:** Claim to Glow
- **Elevator pitch:** Puts skincare claims on trial: consistent photo check-ins through YouCam Skin
  Analysis, a split-face control, and a verdict that only counts changes bigger than the
  measurement noise.

## About the project

````markdown
## Inspiration
Skincare boxes promise things like "reduces tan" or "brightens", and the proof is a before/after
photo taken in different light, at a different angle, often with a filter. Skin apps give you a
score, but none of them can tell you whether a product kept its promise, or whether a change is
bigger than the error of the measurement itself. We wanted to put one claim on trial, honestly, on
our own faces.

## What it does
Claim to Glow takes the claim on the box and runs a small, fair trial:

1. **Claim in.** An agent turns the claim text into YouCam skin concerns to track and a deadline.
2. **Split-face control.** The product goes on one half of the face only. The other half is the
   control, so light, sleep, weather and season hit both sides and cancel out.
3. **Fair check-ins.** The camera captures only when the photo matches day 0: same camera, same
   distance, even light, face straight. A ghost of day 0 helps line it up.
4. **Measure.** YouCam Skin Analysis scores each half-face (`raw_score`).
5. **Filter noise.** Before the trial, repeat photos in one sitting measure how much the score moves
   when nothing changed. The daily photos measure how much more it moves from one day to the next.
6. **Verdict.** **Claim met**, **claim not met**, or **not enough evidence**.

For each claimed concern, with T − C the treated half minus the control half:

```
effect = mean(T − C at the checkpoint) − mean(T − C at baseline)
floor  = 2 × √(SDw² × (1/k + 1/k0) + 2 × SDb²)
```

SDw is the spread of T − C over the repeat photos in one sitting; k and k0 are the photos at the
checkpoint and at baseline (day 0 plus the repeat photos). SDb is the extra noise between days
(light, time of day), from successive daily photos; more photos on the same day can't average it
away, so the checkpoint and the baseline each carry it once. A change counts only when
|effect| > floor. We added SDb after the first week: the day-to-day spread was up to 10× the
within-sitting spread, so the first formula would have called noise a result.

## How we built it
- **YouCam Skin Analysis API** is the measuring instrument. Each photo is split into two mirrored
  half-faces and each half is analysed, so every check-in gives a treated and a control score.
- **Backend:** Python + FastAPI. Analyzer with a local result cache, noise-floor statistics, and a
  pure verdict function with unit tests.
- **Frontend:** React + Vite + TypeScript lab app, installable on the phone. MediaPipe face
  landmarks run on the device for the capture gate; MediaPipe segmentation removes the background,
  so only background-free copies ever leave the PC.
- **Claim agent:** LLM provider layer (Groq, Gemini, NVIDIA) with fallback, checked against the
  allowed YouCam concern list. A person confirms the result.
- **Integrity:** every photo is stored with its SHA-256 fingerprint; a changed file is flagged.
- **Timeline and receipt:** a chart per claimed concern with the noise band, and a face-free
  receipt listing every photo's SHA-256, the verdict and a fingerprint of the receipt itself, plus
  an SVG "Claim to Glow" badge a product page can embed.

## Challenges we ran into
- **Noise between sessions is bigger than noise within one.** Our first day-0 photo sat 2–4 SD away
  from repeat photos taken an hour later, with nothing changed, most likely because window light
  shifted. So we fixed the time and light, and made each checkpoint 3 fresh photos, averaged.
- **Does YouCam accept half-faces?** We tested mirrored half-faces before building on them: it does.
- **Distance.** YouCam rejects faces under 60% of the image width, and our distance drifted from day
  to day (76% of the width on day 0, 58% on day 1). The camera now refuses to capture unless the
  face width matches day 0 within ±8%.
- **Real life gets in the way of a trial.** We missed daily photos on days 11–15 (Suvaani 10–15)
  and 17, 18 and 20, so the day-14 checkpoint was taken on day 16. The app records it as a late
  checkpoint instead of renaming the photos, and the timeline shows the missing days as gaps.
- **We ran out of units.** Each teammate's free units were spent on the noise sets, daily
  photos and checkpoints. On day 21 the keys ran out before the last half-face of Sujeet's and
  Sahni's third photo, so their day-21 verdicts average 2 photos instead of 3; the noise floor
  widens for that automatically.

## Accomplishments that we're proud of
- A real trial, not a mockup: three of us run a 21-day split-face trial since Oct 7, treated side on
  the same half for everyone, each billed to our own YouCam key (Sujeet's day-21 photos to
  Suvaani's, after his ran out).
  - Sujeet and Sahni: a face wash claiming to reduce tan and brighten (tracked: radiance, texture,
    moisture).
  - Suvaani: a brightening cream under one eye, for dark circles (tested off-label, and reported so).
- Checkpoints on day 7, 14 and 21: 3 fresh photos each, averaged. The day-14 checkpoint was taken
  late, on day 16, and the receipt says so.
- We measured the noise before trusting a single result, and an honest "no" is a valid answer.

**Results on day 21 (Oct 28).** Effect = change of treated − control since baseline; a change counts
only beyond ± the noise floor.

| Person | Product | Concern | Effect | Noise floor | Result |
|---|---|---|---|---|---|
| Sujeet | Face wash | Radiance | −7.2 | ±11.0 | no clear change |
| Sujeet | Face wash | Texture | −7.8 | ±38.7 | no clear change |
| Sujeet | Face wash | Moisture | +6.5 | ±7.8 | no clear change |
| Sahni | Face wash | Radiance | −1.7 | ±4.1 | no clear change |
| Sahni | Face wash | Texture | +0.5 | ±7.3 | no clear change |
| Sahni | Face wash | Moisture | +1.6 | ±11.6 | no clear change |
| Suvaani | Brightening cream | Dark circles | −0.4 | ±12.2 | no clear change |

**Verdict: claim not met for all three.** No concern moved beyond the noise in 21 days, and the
late day-14 checkpoint showed no clear change either. The measured changes were all smaller than
what light and day-to-day variation alone produce.

**Why the control matters, in our own data.** A plain before/after (day-0 photo vs the first day-21
photo, YouCam `raw_score`) would have told two false stories:

| | Before/after, whole face | Untreated half, same days | Claim to Glow |
|---|---|---|---|
| Sahni, texture | **+14.3** ("it works") | +6.9 | +0.5 vs ±7.3: no clear change |
| Sujeet, radiance | **−22.2** ("it harmed my skin") | −16.2 | −7.2 vs ±11.0: no clear change |
| Sujeet, moisture | **−15.2** | −15.0 | +6.5 vs ±7.8: no clear change |

The half of the face that never got the product moved the same way, so the change came from light,
season and the day, not the product. This is the problem we set out to solve, caught in a real trial.

## What we learned
- Measure the instrument first. Split-face noise (treated − control) on 5 repeat photos: radiance
  SD 3.06, texture 1.53, dark circles 2.75.
- Use `raw_score` for change over time; `ui_score` differs a lot from it.
- Before/after photos lie in both directions. Over 21 days the untreated half of the face moved by
  up to 16 points on its own; without a control, that reads as a product result.
- The tricks behind fake before/after photos (light, angle, distance) can be blocked at capture time.

## What's next for Claim to Glow
A phone-first agent that plans and runs a trial from a product link, and receipts that brands can
publish next to the claim they made.

_Cosmetic skin metrics only, not medical advice._
````

## Built with

python, fastapi, react, vite, typescript, mediapipe, youcam-skin-analysis-api, perfect-corp,
groq, gemini, nvidia-nim, cloudflare

## Try it out links

- GitHub: https://github.com/sujeet121696/claimtoglow (make it public first, task 26)
- Demo link for judges: https://claimtoglow.kharidwise.com/demo/ (on Devpost since Oct 9)

## Video

https://www.youtube.com/watch?v=Hr0CTB6Ibj8 (uploaded Nov 2, 2:43; slides, demo screens and voice-over). Script, about 2:30. Record the screen; show a face only
if that teammate agrees (the judge demo at /demo/ is face-free and shows the same numbers).

| Time | Screen | Voice |
|---|---|---|
| 0:00–0:15 | A skincare box: "reduces tan, brightens" | "Every skincare box makes a promise. The proof is a before/after photo, in different light, at a different angle. We put one claim on trial instead." |
| 0:15–0:35 | Person editor: claim text, "Suggest from claim" → radiance, texture, moisture | "Claim to Glow turns the claim into YouCam skin concerns to measure." |
| 0:35–1:00 | Camera with the day-0 ghost; capture blocked, then allowed | "The product goes on one half of the face only; the other half is the control. The camera only captures when distance, light and pose match day 0." |
| 1:00–1:20 | Results: photos with their capture check, Analyse split | "YouCam Skin Analysis scores each half. Before the trial we took repeat photos to measure how much the score moves when nothing changed." |
| 1:20–1:55 | Timeline: change since baseline per concern, with the grey noise band | "Three of us ran it for 21 days. Here's the twist. A plain before/after says Sahni's texture improved by 14 points, and that Sujeet's radiance dropped by 22. But the half with no product moved the same way. It was light and season, not the product." |
| 1:55–2:15 | Receipt: verdict, noise floors, SHA-256 per photo | "So the verdict is honest: claim not met, nothing beyond the noise. Every photo's SHA-256 is on the receipt, and it says so when a checkpoint was taken late." |
| 2:15–2:30 | Judge demo URL, badge | "Claim to Glow: the tool that tells you when a glow is just good lighting. Try the demo at claimtoglow.kharidwise.com/demo." |

## Additional info (judges and organisers only)

| Field | Answer |
|---|---|
| Upload a file | None |
| Sponsor / special prizes | **Women in Tech Special Award** (team: Sujeet, Sahni, Suvaani). Rising Star only if a teammate is a student: _confirm_ |
| Submitter type | Team (pick the closest option Devpost lists) |
| Country of residence | India |
| App status | **New**. The repo's first commit (Sep 27) was the MIT license only; all code was written from Oct 6, inside the submission period |
| If existing, what was updated | Leave empty |
| Code repository | `https://github.com/sujeet121696/claimtoglow` (with https://) (public, or shared with contact_event@PerfectCorp.com, by Oct 30) |
| Social posts | LinkedIn post (task 3), then the YouTube demo video |

### Features, functionality, and consumer or retail value

```text
Claim to Glow puts a skincare claim on trial and says whether it held, counting only changes bigger
than the measurement noise.

Features
- Claim agent: claim text from the box or product page -> YouCam skin concerns to track and a deadline.
- Split-face trial: the product goes on one half of the face; the other half is the control, so
  light, sleep, weather and season cancel out.
- Capture gate (on the device, MediaPipe): captures only when camera, distance, light and pose match
  day 0, with a day-0 ghost overlay.
- YouCam Skin Analysis on each mirrored half-face (raw_score), with a local result cache.
- Noise floor per concern, measured from repeat photos before the trial.
- Verdict: claim met, claim not met, or not enough evidence.
- Privacy: original photos stay on the PC; phones only see background-free copies. Every photo has a
  SHA-256 fingerprint.

Consumer value: a shopper learns whether a product is working on their own skin, or whether the
change is just noise from light and angle.
Retail value: honest brands get a cheap, checkable "verified results" signal instead of before/after
photos nobody trusts. That means more YouCam analyses per product, not fewer.
```

### Was there a moment where the API surprised you?

```text
Good: the same photo analysed twice gives identical scores, so all the noise comes from capture,
not from the API. That made it possible to measure the noise and design around it. YouCam also
accepted mirrored half-faces, which is what makes a split-face control possible.
Frustrating: raw_score and ui_score differ a lot, and only raw_score is usable for change over time.
And distance matters: faces under 60% of the image width are rejected, so we added a distance check
against day 0 to the camera.
```

### Industries or use cases nobody is talking about yet

```text
- Claim verification: marketplaces and D2C brands could attach measured, noise-aware results to a
  product claim, instead of before/after photos.
- Ingredient and formulation testing for small brands: a cheap split-face pilot before a clinical
  study.
- Consumer-protection and advertising-standards bodies checking whether a cosmetic claim is
  plausible.
```

### Where did you hit a wall technically, and how did you work around it?

```text
Noise between sessions. Our day-0 photo sat 2-4 SD away from repeat photos taken an hour later,
with nothing changed, most likely because window light shifted. A single photo per day could not
show a real change. Workarounds:
1. Split-face: treated minus control cancels light and season that hit both halves.
2. Noise floor per concern from repeat photos; a change counts only beyond it.
3. Capture gate: same camera, distance (+/-8% face width), light and pose as day 0, or no capture.
4. Checkpoints on day 7, 14 and 21 are 3 fresh photos, averaged, which shrinks the floor.
```
