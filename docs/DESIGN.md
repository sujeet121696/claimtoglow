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

| Palette from KharidWise (Oct 7) | One visual family across projects. Deep Navy `#0A2540` text and primary buttons, link blue `#0077B6`, AI Green `#00C853` for fills only (2.2:1 on white, so small "pass" text uses `#007A36`), Cyan `#00B0FF` for dark-mode actions, Lavender note background `#F3EFFA`, page `#F6F4FB`. Tokens in `web/src/styles/tokens.css` |
| Lab is organised by person (Oct 7) | Users think "my trial", not "photo sets": person picker, Today screen, Daily check-in / Repeat photos instead of typed set names |

## 4. Open questions

- Receipt metaphor: literal till-receipt styling, or a clean report with a receipt motif?

## 5. Brand (Oct 7, follows KharidWise)

- Wordmark like "kharid**wise**": "Claim to" in text navy, "**Glow**" in AI Green `#00c853`,
  Bricolage Grotesque 800, 1.3rem, with the 34 px logo tile before it. Same as KharidWise, "Glow"
  is #00c853 on the light page (2.2:1 contrast, below the 3:1 WCAG asks for large text).
- Fonts: KharidWise's self-hosted files (`web/public/fonts`): Bricolage Grotesque for headings,
  Figtree for text (both SIL Open Font License).
- Logo (`web/public/favicon.svg`): a navy tile with a face split down the middle, the treated half
  green and the control half outlined. Own mark, not KharidWise's cart logo.
- Icons as KharidWise ships them: `favicon.ico`, `apple-touch-icon.png`, `icons/` (192, 512,
  maskable 512), `manifest.webmanifest`, light and dark `theme-color`.
