# PRD

> What Claim to Glow is, why it's different, and what's in and out of scope.

**One line:** Skin apps tell you your score. Claim to Glow tells you whether the product kept its
promise, and only when the evidence is strong enough to say so.

## 1. Problem

Skincare marketing makes time-boxed, measurable-sounding claims ("reduces dark spots in 14 days")
backed by before/after photos taken under different light, angles and filters. Nobody can check
them.

- **Shoppers** can't tell whether a product worked for them, or whether a change is real.
- **Honest brands** can't prove their results cheaply. A clinical trial is out of reach for most
  small D2C brands.

## 2. Solution

A web app that puts one product claim on trial:

| Step | What happens |
|---|---|
| 1. Claim in | An agent turns the claim text into skin concerns to track, a direction and a deadline |
| 2. Fair check-ins | The camera captures only when light, distance and pose match day 0 |
| 3. Measure | YouCam Skin Analysis scores each check-in (`raw_score`) |
| 4. Filter noise | A change counts only if it's bigger than the measured noise floor |
| 5. Verdict | **Claim met**, **claim not met** or **not enough evidence** |
| 6. Receipt | A tamper-evident public result page, plus a "Verified results" badge for product pages |

## 3. Differentiation

**Existing tools**

| Tool | What it does | What it can't do |
|---|---|---|
| AI skin scanners (Glow, GlowScan, GlowMeter, Lovi) | Selfie → skin score, progress tracking | Separate real change from noise, or test a claim |
| Proof & Glow (proofandglow.com) | Grades claims against published research | Say whether it worked *on your skin* |
| GlowProof (tryglowproof.com) | Guided before/after photo diary | Measure anything; it avoids claims on purpose |
| Brand before/after photos | Marketing | Be checked at all |

**What only Claim to Glow combines**

1. **Claim-first.** It starts from the promise on the box, not a selfie.
2. **Measures its own error.** A repeat-photo test sets a noise floor per concern. Changes inside
   it are reported as noise, and "not enough evidence" is a valid outcome.
3. **Split-face control.** The product goes on one half of the face; the untreated half is the
   control, so light, sleep, weather and season hit both sides and cancel out.
4. **Controlled capture.** The tricks behind fake before/after photos (light, angle, distance,
   filters) are blocked at capture time.
5. **Tamper-evident receipt.** Photo hashes and dates make the result checkable after the fact.

## 4. Why it can win

**Pattern from the previous edition** (238 projects): winners solved trust, fairness or access
problems. Examples: KeepMe (try-on that shows unwanted face edits), ConfidFit (honest product labels),
ShadeSpan and CASTING (measured skin tones), Aloud (blind shoppers). Generic trackers and stylists
didn't place. Claim to Glow brings the "measure it honestly" idea to skincare claims, which no winner
covered.

**Mapped to the judging criteria (equal weight)**

| Criterion | How we score |
|---|---|
| Technological implementation | YouCam is the engine, not a wrapper; `raw_score` over `ui_score`; noise-floor statistics; capture gating |
| Design | Claim-first flow, noise band on every chart, receipt-style verdict |
| Potential impact | Shoppers get proof; honest brands get a cheap verification signal |
| Quality of the idea | Claim testing is new in this space (see section 3) |

**Sponsor fit:** Perfect Corp sells to beauty brands. The pitch is pro-brand: honest brands earn a
badge, which is a reason to use more YouCam.

## 5. Target users

| User | Need |
|---|---|
| Shopper starting a new product | "Is this actually working, or am I imagining it?" |
| Honest brand, especially Indian D2C | A cheap, credible "verified results" signal |

## 6. Goals

| # | Goal | Notes |
|---|---|---|
| G1 | Turn a claim into metrics | Agent: claim text → `{ concerns[], direction, deadline_days }` |
| G2 | Fair check-ins | Reject photos that don't match day 0 |
| G3 | Measure | YouCam Skin Analysis, `raw_score` |
| G4 | Honest verdict | Noise-floor rule (see ARCHITECTURE.md) |
| G5 | Tamper-evident receipt | Public page with photo hashes |
| G6 | eCommerce hook | Embeddable badge (mockup acceptable) |

G2 and G4 are the core. Without them this is just another skin tracker.

## 7. Scope

**In (hackathon demo)**
- Real split-face trials as the demo story: the author plus two consenting teammates (Sahni,
  Suvaani), one product per person. Day 0 Oct 7; 21 days, checkpoints day 7, 14 and 21
  (Oct 14, 21, 28).
- Web app: claim, capture, timeline, verdict and receipt screens.

**Out**
- Medical claims or diagnosis. Wording is always "cosmetic skin metrics" and "observed change".
- Multi-user accounts, brand dashboards, billing.
- A real Shopify app. The badge is a snippet or mockup.
- The post-hackathon agent, accounts and scaling: see [VISION.md](VISION.md).

## 8. Success criteria

| By | Criterion |
|---|---|
| Oct 7 ✓ | Noise floor measured; go/no-go decided |
| Oct 26 | A stranger can open the test link, run a claim end to end, and read a verdict |
| Oct 26 | Demo video tells claim → split-face trial → verdict in under 3 minutes; submitted |
| Oct 28 | Consistent daily split-face check-ins through day 21; final verdict added by Oct 29 |

## 9. Constraints

**Hackathon**
- Page: https://youcam-api-skin-ai-ecommerce.devpost.com/
- Submissions Sep 29 – **Nov 2, 2026, 11:45 am ET**. Judging Nov 3–20, winners ~Nov 24.
- Must integrate ≥1 YouCam API with clear consumer/retail value, not a surface-level wrapper.
- Deliverables: working project; repo (public, or private and shared with
  contact_event@PerfectCorp.com); text description; **1–3 min public YouTube demo**; test link
  (with login if private).
- One prize per project: $2,500 / $1,000 / $500 (plus blog feature and product-team meeting),
  Women in Tech $1,000, Rising Star $1,000.

**Budget**
- 1,000 free API units per person (90 days), plus up to 1,000 for sharing on social media.
- Units are charged only on a successful analysis: 14 units per analysis, 2 per split-face photo.
- Expected use per person: ~168 (day 0 + 5 repeats) + ~252 (3 checkpoints × 3 photos) = ~420.
  Daily photos are analysed only if units are left at the end.

**Time**
- Finish and submit by **Oct 26** (one week early, decided Oct 8), alongside Ringproof (Nebius,
  Oct 30). Only the day-21 verdict is added after, by Oct 29.

## 10. Risks

| Risk | Impact | Mitigation |
|---|---|---|
| Scores too noisy to detect real change | Kills the idea | Noise test first; go/no-go by **Oct 5** |
| Photos taken in different conditions | False verdicts | Capture gating; fixed setup for the real trial |
| Looks like another skin tracker | Weak "idea" score | Demo opens on the claim on the box, not a selfie |
| Sponsor sells to beauty brands | Awkward with judges | Pro-brand pitch: verified results for honest brands |
| Medical-claim wording | Credibility, compliance | "Cosmetic skin metrics" everywhere; disclaimer in app and video |
| Only ~3 days of full-time build | Unfinished app | Hard parts (gating, noise logic, photos) done in October |
| Noise floor from 10 photos is a rough estimate | Floor too tight or too loose | State n in the app; add more repeat photos if the floor looks off |

## 11. What we get

| Outcome | How |
|---|---|
| Prize chance | Top 3 cash, plus blog feature and a Perfect Corp product-team meeting |
| Portfolio | Public AI + computer vision + eCommerce project |
| Content | "I tested a skincare claim on half my face with AI" doubles as the demo and a channel video |
| Product option | Possible "verified results" service for Indian D2C skincare brands |
| Reuse | Provider layer and dashboard pattern shared with Ringproof |

## 12. Background

- Idea chosen Sep 27 after reviewing the previous YouCam hackathon's project gallery.
- Naming: *Proof of Glow* was dropped because it's too close to Proof & Glow. *SkinReceipt* and
  *Truth or Glow* were clean but weaker; Truth or Glow sits near OLEHENRIKSEN's "Truth" skincare
  line. **Claim to Glow** came back clean on Sep 27: .com/.net/.app unregistered, no app, repo or
  product found.
