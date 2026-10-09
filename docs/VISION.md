# Vision

> Where Claim to Glow goes after the hackathon, and the decisions taken now so the hackathon build
> doesn't have to be thrown away. Written Oct 6, 2026.

## 1. The idea, grown up

**An AI agent that runs a fair trial of any skincare product on your own face, and tells you
honestly whether it worked.** Every finished trial also becomes evidence about the product, so
over time the agent builds the first *measured* record of which claims hold up.

| Today (hackathon) | After |
|---|---|
| A lab app we drive by hand | An agent that runs the trial for you: plans it, reminds you, checks each photo, decides when to measure, explains the verdict |
| 3 people, 2 products | Anyone with a phone; brands sponsoring trials with volunteers |
| One verdict per person | Per-person verdicts **plus** pooled evidence per product |

## 2. What the agent does

| Step | Agent's job | Done by |
|---|---|---|
| Intake | Reads a product page, box photo or link; extracts claims and ingredients | LLM (vision) → structured output |
| Plan | Maps claims to measurable concerns, picks duration, decides if split-face is possible (leave-on vs rinse-off), adds safety steps (patch test, sunscreen with acids) | LLM proposes, rules validate |
| Run | Daily reminder, guided capture, retakes on failed gate, logs adherence ("applied last night?") | Tools + gate on device |
| Measure | Decides **when** to spend analysis units: fixed checkpoints, plus extra when a change is close to the noise floor | Deterministic policy |
| Safety | Stops the trial if the treated side's redness rises past the floor, or the user reports irritation | Deterministic rule, agent explains |
| Verdict | Met / not met / not enough evidence, with the numbers | **Deterministic statistics, never the LLM** |
| Explain | Plain-language summary, receipt, share card | LLM over the verdict data |

**Rule of trust:** the LLM plans, talks and explains. It never decides a score, a floor or a
verdict. Those are pure functions anyone can re-run from the receipt.

## 3. Decisions (taken now)

| # | Decision | Why | What it means for the hackathon build |
|---|---|---|---|
| D1 | **Tools-first agent.** Every capability is a deterministic tool with typed input/output; the agent only orchestrates | Testable, cheap, auditable; swapping the LLM changes nothing important | Keep `app/` functions pure (gate, noise, verdict) and the API shaped like tools |
| D2 | **One tool layer, many front doors:** web app now, then an MCP server and WhatsApp | Same tools serve a chat agent, Claude/ChatGPT via MCP, and messaging | No logic in the UI beyond capture; the UI calls the same endpoints a tool would |
| D3 | **Trial is the core entity:** Product → Claim → Trial (per person) → Check-in → Analysis → Verdict | Today's "set" naming (`trial-<person>`) is a stand-in | Add a small `trial.json` per trial (product, claim, concerns, treated side, start date, key) during M2, not a database |
| D4 | **Storage behind an interface:** local files now; Postgres + object storage (R2/S3) at launch, photos addressed by SHA-256 | Hashes already make photos tamper-evident and deduplicated | Keep all file access in `app/` (already true) |
| D5 | **Skin-analysis provider interface**, YouCam first. Noise floors are calibrated per provider | Scores from different providers aren't comparable; avoids lock-in | `app/youcam.py` stays the only file that knows YouCam |
| D6 | **Capture gate runs on the device** | Costs nothing to scale, and photos are checked before any upload | Already true (`web/src/gate.ts`) |
| D7 | **Budget-aware measuring:** analyse checkpoints, not every photo; photos are always kept | 14 units per analysis, ×2 for split-face | Already the hackathon plan (day 0, 7, 14, 21) |
| D8 | **Verified tier = in-app capture only.** Uploaded photos are allowed but never count toward product evidence | Stops cherry-picked or edited photos from polluting pooled results | Already recorded per photo (`meta.source`, gate result, hash) |
| D9 | **Privacy by design:** explicit consent per participant, delete on request, face photos used for nothing else, retention limits. Follows India's DPDP Act | Face photos are sensitive personal data; trust is the product | Photos stay local and out of git; other devices only see background-free copies (Oct 7) |
| D10 | **Hosting follows the data:** the lab PC behind a Cloudflare Tunnel + Access now; a cloud server with object storage (D4) only from P1 | Photos never leave the PC during the hackathon; no server to run or secure | One FastAPI process serves API + built app, so moving it to a server later is a deploy, not a rewrite |

## 4. Phases

| Phase | When | What ships |
|---|---|---|
| P0 Hackathon | Oct 26 (deadline Nov 2) | Lab, 3 real trials, verdict, receipt, badge mockup |
| P1 Personal agent | Nov–Dec | Phone-first web app (PWA): paste a product link → the agent plans and runs your trial with daily nudges |
| P2 Verified results for brands | Q1 2027 | A brand sponsors a cohort (e.g. 20 volunteers), gets a report and an embeddable badge; Shopify/marketplace embed |
| P3 Claims index | Later | Public page per product: "measured on 41 people: texture +3.1, radiance no change". Only verified trials count |

## 5. Ideas worth testing

- **Head-to-head mode:** product A on one half, product B on the other. Answers "is the ₹2,000 serum better than the ₹300 one?"
- **Routine debugger:** add one product at a time to a routine and measure each step.
- **Safety early warning:** a rising redness score on the treated side flags irritation before the user notices.
- **Share card:** "I put this claim on trial: not met." A natural growth loop that's also honest.

## 6. Risks

| Risk | Mitigation |
|---|---|
| Looks like a medical device | Cosmetic wording only, no diagnosis, no treatment advice (RULES.md) |
| Analysis cost per trial | Checkpoint policy (D7), provider choice (D5), brand-paid cohorts (P2) |
| Users quit mid-trial | Short trials, reminders, "not enough evidence" is still a result |
| Small real effects | That *is* the finding; the noise floor keeps it honest |
| Dependence on one provider | D5 |

## 7. Not now

Accounts, payments, a database, a mobile app, the MCP server, WhatsApp. The hackathon build only
has to respect D1–D10 so none of this needs a rewrite later.
