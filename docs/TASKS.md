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
3. [ ] Share the hackathon on social media for bonus units (500 per platform, up to +1,000)
3a. [ ] Ask the organisers for extra test units (Devpost discussion or contact_event@PerfectCorp.com)
3b. [x] Teammates (Sahni, Suvaani) register on Devpost, join the team, and redeem their own YouCam codes.
        Codes are per registrant and non-transferable; each key analyses only its owner's trial.
        Team has 2 women, so it is eligible for the Women in Tech prize.
        Oct 7: both YouCam keys are in `.env` (`YOUCAM_API_SAHNI_KEY`, `YOUCAM_API_SUVAANI_KEY`) and
        accepted by the API, and all three keys are different. Oct 7: both joined the Devpost team.
        Still to confirm: both redeemed their units (check each YouCam console)

**Trial (before day 0)**
4. [ ] Pick one product with a specific claim of **21 days or less**. Photograph the claim on the box
   - Candidates (Oct 6): **Demelan+ Cream** (leave-on; kojic acid, arbutin, glycolic acid; "even tone
     over time") and **Ghar Soaps Magic Face Wash** (rinse-off; "reduce tan, brightens, glow"). Neither
     gives a deadline, so the deadline is 21 days, labelled "set by tester"
   - **Decided Oct 7:** 3 people, each a split-face trial. `trial-sujeet` and `trial-sahni`: Magic
     Face Wash (treated half only). `trial-suvaani`: **Demelan+ Cream under the treated eye only**, for dark
     circles; tracked concern `dark_circle_v2` (Suvaani scored 61.0 on Oct 6). The brand claims even tone
     and brightening, not dark circles, so the verdict must say it was tested off-label. Glycolic acid
     near the eyes: patch test, thin layer on the under-eye bone only, night only, stop on irritation. Treated side for everyone: **image left** (the person's right side).
     Everyone consents to YouCam processing. Day 0 was Oct 7.
   - **Oct 7, Sujeet:** camera for the whole trial is the **phone's front camera in the lab** (day-00 was
     taken with it, so it stays front)
     (`npm run dev:phone`, https://<pc-ip>:5173 → Capture, phone on a stand, same spot).
     The phone day-00 and 5 webcam repeat shots (taken 1 s apart, not fresh) were moved to
     `photos/_retired/`; day-00 is retaken on Oct 7 in the lab (an earlier face-wash use that day is
     noted in trial.json). **Sahni:** her webcam and copied-in day-00 shots were retired (one was
     overwritten by an old file, fingerprint mismatch); day-00 retaken on Oct 7 at 19:00 IST with the
     phone front camera in the lab, so her daily photo is around 19:00. Never copy files into trial
     folders by hand. **Suvaani:** tonight (current day-00 is an old photo that fails the gate). Rule: one camera per person for day 0, daily photos and repeat photos. Each person's details live in
     `photos/trial-<person>/trial.json` (edit in the lab: Person → Edit)
   - Cost (Oct 6 console): an SD analysis with 10 concerns costs **14 units**; a split-face photo costs
     2 analyses. Same photo re-analysed gives identical scores, so all noise comes from capture
   - Face wash trials track `radiance`, `texture` and `moisture` (from the full product page, Oct 7; all 3 faces already score 93–97 on `age_spot`)
   - **Budget per person (Oct 7):** noise set (day-00 + 5 repeats, split) 168 units + checkpoints
     day 7/14/21 (3 photos each) 252 units = **~420 units**. Daily photos are kept but analysed only
     if units are left at the end (+504). Each person's photos are billed to their own key
4a. [x] Split-face: treated side is image left for everyone, fixed for the whole trial.
       Apply only to that half, stopping at the nose line. Nose centred in frame for every photo
5. [x] Fix the setup: same spot, same time of day, phone on a stand, the phone's front camera in the
       lab (one camera per person, checked by the gate), no filters or beauty mode, neutral face
6. [ ] **Day-0 photo on Oct 7 (moved from Oct 3), before the first use**. Done: Sujeet (16:49 IST),
       Sahni (19:00 IST). To do: Suvaani, then one photo every morning
       (before any product, sunscreen on the whole face after). One set per person: `trial-<person>`,
       e.g. `trial-sujeet`, named `day-00`, `day-01`, … automatically by the lab app

**Noise test**
7. [ ] In the same setup and sitting, take repeat photos into `noise-<person>` (≥5 each). Done:
       Sujeet 5, Sahni 5 (all passed the gate). To do: Suvaani. Step out of frame and back between shots ("Fresh shots" in the lab enforces it)
8. [x] API tested Oct 6 on 2 faces (photos now in `photos/_retired/api-test/`): works, raw scores 0–100, higher looks better, `ui_score` differs a lot from raw. Face <60% width is rejected. Units per analysis: _pending (balance was 1,026)_
8a. [x] `python scripts/noise_test.py photos/noise-sujeet --split --limit 2`: does YouCam accept the
       mirrored half-faces? If yes, run the full `--split` set and record the `L-R` floor too
9. [ ] Run the full noise test and record the noise floor per concern below. Done: Sujeet.
       To do: Sahni (168 units on her key), Suvaani
10. [ ] **Go/no-go:** go if the claimed concern's noise floor is small next to a realistic change
        (a few points). If it's huge, switch to the backup idea (Shaadi Look Planner)

**Noise floor results**

Sujeet, Oct 7: phone front camera, split-face, 5 repeat photos in one sitting (12 analyses,
~168 units). YouCam **accepts mirrored half-faces** (8a done). Series is treated − control (L−R).

| Concern | n | SD (L−R) | Floor 1 photo vs 1 (2√2 SD) | Floor 3 vs 6 photos |
|---|---|---|---|---|
| radiance | 5 | 3.06 | 8.65 | 4.33 |
| texture | 5 | 1.53 | 4.34 | 2.17 |
| dark_circle_v2 | 5 | 2.75 | 7.76 | 3.88 |
| age_spot | 5 | 0.89 | 2.53 | 1.26 |
| pore | 5 | 6.46 | 18.26 | 9.13 |
| redness | 5 | 7.41 | 20.96 | 10.48 |

**Finding:** day-00 (11:19) sits 2–4 SD away from the repeat photos (12:11) on radiance, texture and
pore, although nothing changed in between. Noise between sessions is bigger than within one sitting,
most likely because window light shifted. **Decision (go, with changes):** fixed light at a fixed time
every day; each checkpoint (day 7, 14, 21) is 3 fresh photos averaged; day 0 = the 5 repeat photos +
day-00. Daily single photos are still taken and kept.

## Oct 6 – 18 · Daily photo + two weekends → M2
11. [ ] Keep daily photos going
12. [x] Choose backend and web stack, and record them in `ARCHITECTURE.md` (Oct 6: FastAPI + React/Vite, as Ringproof)
13. [x] Analyzer module with local result cache (`app/analyzer.py`, shared with the noise script)
14. [x] Direction of `raw_score`: higher is better for every concern (YouCam docs, Oct 7). Shown as ↑
        on every score column; changes are coloured ▲ better / ▼ worse only beyond the noise floor
15. [x] Verdict engine with the noise-floor rule (pure function, VISION D1). Oct 7: `app/verdict.py`,
        tests in `tests/`, verdict on each Today card, claimed concerns per trial (Person → Edit).
        Baseline = day-00 + repeat photos; checkpoint = latest analysed day (one photo for now)
15b. [ ] Checkpoint of 3 photos (day 7/14/21): the lab saves one photo per day, so extra checkpoint
        photos need a naming rule before day 7 (Oct 14)
15c. [x] Direction confirmed (task 14): the verdict's higher-is-better default is correct
15a. [x] `trial.json` per trial: product, claim, treated side, start date (VISION D3). Lab is now organised by person: Today screen, person picker, day numbers from day 0, Retake
16. [ ] Capture gate: brightness + face framing/pose (MediaPipe), day-0 ghost overlay
    - [x] Built in the lab app (`web/src/gate.ts`): Capture, Upload and Results screens. Checked on
          the 2 test photos via Upload; flags uneven light and off-centre nose correctly
    - [x] Test the live camera on the laptop and on the phone (`npm run dev:phone`)
    - [x] Oct 7 fixes: same-camera and light-direction checks vs day 0, phone full-screen capture,
          day-0 camera picked automatically, Wi-Fi lock with QR unlock, fingerprint mismatch badge,
          notes field separate from the claim, test sets billed to their owner
    - [x] Oct 7: background removed from every photo shown in the lab and on other devices
          (originals stay on the PC, never sent to phones); countdown no longer restarts on one
          jittery frame; "Matches day 0" is optional (recorded, not blocking); the Test kind is removed
          (4 repeat photos had landed there by mistake); photos are Daily check-in or Repeat photos only
    - [ ] Tune thresholds from the day-0 session
16a. [ ] Open the lab from anywhere (README "Open it from anywhere"). Code done Oct 7: FastAPI serves
       the built app, tunnel traffic counts as remote and needs the lab token, no caching of photos,
       "Open on phone" offers Anywhere / Same Wi-Fi with Copy link. To do: tunnel login, create and
       DNS route, Access app with the 3 team emails, `PUBLIC_URL` in `.env`

## Oct 19 – 29 · Daily photo only → M3
17. [ ] Keep daily photos going (trial ends by Oct 24)
18. [ ] Once a week, analyse the new photos (≈10 min) to catch setup problems early

## Oct 30 – Nov 1 · Full build → M4, M5
19. [ ] Analyse the final trial photos
20. [x] Claim agent: claim text → `{ concerns[], deadline_days }`. Oct 7: built (`app/llm.py`, `app/claim.py`,
        "Suggest from claim" in Person → Edit). Tested live on Groq, Gemini and NVIDIA. Real claims:
        face wash (full product page) → radiance, texture, moisture (all 3 models agree; set for Sujeet and
        Sahni); Demelan+ → age_spot, radiance (Suvaani's trial stays on dark circles, off-label)
21. [ ] Web app: claim, capture, timeline and verdict screens
22. [ ] Receipt page with photo hashes, plus the badge snippet
23. [ ] Public demo link for judges (a read-only demo, not the live lab with real faces)
24. [ ] Demo video (1–3 min): claim on the box → split-face trial → verdict, uploaded to YouTube
25. [ ] Devpost text: problem, differentiation, how YouCam is used, why `raw_score` + noise floor
26. [ ] Make the repo public (or share it with contact_event@PerfectCorp.com)
27. [ ] Final check against the rules, then submit
