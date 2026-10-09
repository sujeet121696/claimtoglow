# Devpost submission

> Text for the Devpost project page (task 25). Only verified facts. Results per person go under
> "Accomplishments" after the day-14 checkpoint (Oct 21) and the day-21 checkpoint (Oct 28).
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
   when nothing changed.
6. **Verdict.** **Claim met**, **claim not met**, or **not enough evidence**.

For each claimed concern, with T − C the treated half minus the control half:

```
effect = mean(T − C at the checkpoint) − mean(T − C at baseline)
floor  = 2 × SD × √(1/k + 1/k0)
```

SD is the spread of T − C over the repeat photos; k and k0 are the photos at the checkpoint and at
baseline (day 0 plus the repeat photos). A change counts only when |effect| > floor.

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

## Accomplishments that we're proud of
- A real trial, not a mockup: three of us run a 21-day split-face trial since Oct 7, treated side on
  the same half for everyone, each billed to our own YouCam key.
  - Sujeet and Sahni: a face wash claiming to reduce tan and brighten (tracked: radiance, texture,
    moisture).
  - Suvaani: a brightening cream under one eye, for dark circles (tested off-label, and reported so).
- Checkpoints on day 7, 14 and 21: 3 fresh photos each, averaged.
- We measured the noise before trusting a single result, and "not enough evidence" is a valid answer.

## What we learned
- Measure the instrument first. Split-face noise (treated − control) on 5 repeat photos: radiance
  SD 3.06, texture 1.53, dark circles 2.75.
- Use `raw_score` for change over time; `ui_score` differs a lot from it.
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

_TODO_ (task 24, YouTube, 1–3 min)

## Additional info (judges and organisers only)

| Field | Answer |
|---|---|
| Upload a file | None |
| Sponsor / special prizes | **Women in Tech Special Award** (team: Sujeet, Sahni, Suvaani). Rising Star only if a teammate is a student: _confirm_ |
| Submitter type | Team (pick the closest option Devpost lists) |
| Country of residence | India |
| App status | **New**. The repo's first commit (Sep 27) was the MIT license only; all code was written from Oct 6, inside the submission period |
| If existing, what was updated | Leave empty |
| Code repository | `https://github.com/sujeet121696/claimtoglow` (with https://) (public, or shared with contact_event@PerfectCorp.com, by Oct 26) |
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
