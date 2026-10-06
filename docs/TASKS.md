# Tasks

> Build plan. Deadline: **Nov 2, 2026, 11:45 am ET**. Target submit: **Nov 1** (1-day buffer).
> Ringproof (Nebius, Oct 30) comes first. This project gets two weekends in October, then the
> full build Oct 30 – Nov 1.

## Milestones

| # | Milestone | Target |
|---|---|---|
| M1 | Trial started, noise floor measured, go/no-go decided | Oct 11 (moved from Oct 5) |
| M2 | Analyzer, verdict engine and capture gate working in code | Oct 18 |
| M3 | Split-face trial complete (day 0 Oct 7, ≤21 days) | Oct 28 |
| M4 | Full app deployed, demo video on YouTube | Nov 1 |
| M5 | Submitted | Nov 1 |

## Time split with Ringproof

| Dates | Ringproof | Claim to Glow |
|---|---|---|
| Sep 28 – Oct 5 | Week 1 foundations | ≈2 h setup + daily photo |
| Oct 6 – 18 | Core pipeline, dashboard | Daily photo + weekends Oct 10–11, Oct 17–18 |
| Oct 19 – 29 | Polish, submit | **Daily photo only** + weekly analysis run (≈10 min) |
| Oct 30 – Nov 1 | Done | Full build |

## Done
- [x] Idea, name, repo, MIT license
- [x] Project docs
- [x] Noise-test script (`scripts/noise_test.py`)

## Week 1 · Sep 28 – Oct 5 → M1

**Setup**
1. [x] Register on Devpost (submissions open Sep 29)
2. [x] Create a YouCam API account via the India link: https://yce.makeupar.com/ai-api. 1,000 free units redeemed Oct 6, valid until Jan 4, 2027
3. [ ] Share the hackathon on social media for bonus units (up to +1,000)

**Trial (before day 0)**
4. [ ] Pick one product with a specific claim of **21 days or less**. Photograph the claim on the box
   - Fallback (Oct 6): Ghar Soaps Magic Face Wash (saffron + lactic acid; "reduce tan, brightens, glow", no deadline, rinse-off). Use it if no dated leave-on claim by Oct 7
4a. [ ] Split-face: pick the treated side (say, the side on the image's left) and keep it fixed.
       Apply only to that half, stopping at the nose line. Nose centred in frame for every photo
5. [ ] Fix the setup: same spot, same time of day, phone on a stand, rear camera, no filters or
       beauty mode, face 60–80% of frame width, neutral face, mouth closed
6. [ ] **Day-0 photo on Oct 7 (moved from Oct 3), before the first use**, then one photo every day into
       `photos/trial/` named `day-00.jpg`, `day-01.jpg`, … Photos keep; they can be analysed later

**Noise test**
7. [ ] In the same setup and sitting, take 10 more photos into `photos/noise-01/`. Step out of
       frame and back between shots so each is a fresh capture
8. [x] API tested Oct 6 on 2 faces (`photos/api-test/`): works, raw scores 0–100, higher looks better, `ui_score` differs a lot from raw. Face <60% width is rejected. Units per analysis: _pending (balance was 1,026)_
8a. [ ] `python scripts/noise_test.py photos/noise-01 --split --limit 2`: does YouCam accept the
       mirrored half-faces? If yes, run the full `--split` set and record the `L-R` floor too
9. [ ] Run the full noise test and record the noise floor per concern below
10. [ ] **Go/no-go:** go if the claimed concern's noise floor is small next to a realistic change
        (a few points). If it's huge, switch to the backup idea (Shaadi Look Planner)

**Noise floor results**

| Concern | n | SD | Floor (2√2 SD) |
|---|---|---|---|
| _pending_ | | | |

## Oct 6 – 18 · Daily photo + two weekends → M2
11. [ ] Keep daily photos going
12. [x] Choose backend and web stack, and record them in `ARCHITECTURE.md` (Oct 6: FastAPI + React/Vite, as Ringproof)
13. [x] Analyzer module with local result cache (`app/analyzer.py`, shared with the noise script)
14. [ ] Analyse trial photos so far; confirm which direction of `raw_score` is "better" per concern
15. [ ] Verdict engine with the noise-floor rule
16. [ ] Capture gate: brightness + face framing/pose (MediaPipe), day-0 ghost overlay
    - [x] Built in the lab app (`web/src/gate.ts`): Capture, Upload and Results screens. Checked on
          the 2 test photos via Upload; flags uneven light and off-centre nose correctly
    - [ ] Test the live camera on the laptop and on the phone (`npm run dev:phone`)
    - [ ] Tune thresholds from the day-0 session

## Oct 19 – 29 · Daily photo only → M3
17. [ ] Keep daily photos going (trial ends by Oct 24)
18. [ ] Once a week, analyse the new photos (≈10 min) to catch setup problems early

## Oct 30 – Nov 1 · Full build → M4, M5
19. [ ] Analyse the final trial photos
20. [ ] Claim agent: claim text → `{ concerns[], direction, deadline_days }`
21. [ ] Web app: claim, capture, timeline and verdict screens
22. [ ] Receipt page with photo hashes, plus the badge snippet
23. [ ] Deploy and get a public test link
24. [ ] Demo video (1–3 min): claim on the box → split-face trial → verdict, uploaded to YouTube
25. [ ] Devpost text: problem, differentiation, how YouCam is used, why `raw_score` + noise floor
26. [ ] Make the repo public (or share it with contact_event@PerfectCorp.com)
27. [ ] Final check against the rules, then submit
