# Design

> UI/UX direction for the demo app.

## 1. Principles

- **Lead with the claim, not the selfie.** The first screen is the product's claim on trial.
- **Honesty is the look.** Show the noise band on every chart. A change inside it is visibly "noise".
- **The receipt is the climax.** The verdict page should feel like proof you can hand someone.

## 2. Screens (draft)

| Screen | Shows |
|---|---|
| Claim | Product name, claim text, the agent's metric mapping and deadline |
| Capture | Live camera, day-0 ghost overlay, live checks (light, framing, pose), shutter enabled only when all pass |
| Timeline | Check-ins by day, per-concern line with the noise band shaded |
| Verdict / receipt | Receipt-style page: each claimed concern, change, ✓/✗/–, photo hashes, dates |
| Badge | Embeddable "Verified results" snippet for a product page |

## 3. Decisions

| Decision | Reason |
|---|---|
| Verdicts are met / not met / not enough evidence | Three outcomes are more honest than pass/fail |
| Demo story is the author's real split-face trial | Real data beats a simulation, and no competitor will have it |
| Pitch is pro-brand | Perfect Corp's customers are beauty brands |

## 4. Open questions

- Visual style, colors, logo.
- Receipt metaphor: literal till-receipt styling, or a clean report with a receipt motif?
