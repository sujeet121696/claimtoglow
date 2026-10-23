# Tasks

> Build plan. Deadline: **Nov 2, 2026, 11:45 am ET** (10:15 pm IST).
> **Decided Oct 23 (was Oct 26):** submit **by Oct 31**, with the final day-21 verdict (checkpoint
> Oct 28) in the video and text from the start; Nov 1–2 stay as buffer.

## Milestones

| # | Milestone | Target |
|---|---|---|
| M1 | Trial started, noise floor measured, go/no-go decided | Oct 7 ✓ |
| M2 | Analyzer, verdict engine and capture gate working in code | Oct 7 ✓ |
| M3 | 3-photo checkpoints built (Oct 8 ✓); day-7 checkpoint analysed | Oct 14 |
| M4 | Receipt, timeline and judge demo link done (Oct 8–9 ✓); day-14 checkpoint missed, made up on day 16 (Oct 23) | Oct 23 |
| M5 | Day-21 checkpoint analysed, final verdict | Oct 28 |
| M6 | Demo video on YouTube, Devpost text, repo public, **submitted** | **Oct 31** |

## Week plan

| Dates | Work |
|---|---|
| Every day | Daily photo for all three (same camera, spot, light and time) |
| Oct 8 – 13 (weekend Oct 10–11) | ~~15b 3-photo checkpoints~~ ✓, ~~Sahni's extra repeat photo~~ ✓, ~~tune gate thresholds (16)~~ ✓, social share (3) |
| **Oct 14 (day 7)** | Checkpoint: 3 fresh photos each, split-analysed |
| Oct 15 – 20 (weekend Oct 17–18) | ~~Timeline (21)~~ ✓, ~~receipt + badge (22)~~ ✓, ~~judge demo (23)~~ ✓ (Oct 8–9) |
| **Oct 21 (day 14)** | Checkpoint: 3 fresh photos each, split-analysed; verdict for the demo |
| **Oct 23 (day 16)** | Late day-14 checkpoint: 3 photos each, split-analysed |
| Oct 24 – 27 (weekend Oct 24–25) | UI fixes, LinkedIn post (3), Devpost text draft (25), video script (24) |
| **Oct 28 (day 21)** | Final checkpoint: 3 photos each, analysed the same day; final verdict |
| Oct 29 – 30 | Record the video with the final verdict (24), final Devpost text (25), security checks, repo public (26) |
| **Oct 31** | Rules check and **submit (27)**. Nov 1–2 buffer |

## Done
- [x] Idea, name, repo, MIT license
- [x] Project docs
- [x] Noise-test script (`scripts/noise_test.py`)

## Week 1 · Sep 28 – Oct 5 → M1

**Setup**
1. [x] Register on Devpost (submissions open Sep 29)
2. [x] Create a YouCam API account via the India link: https://yce.makeupar.com/ai-api. 1,000 free units redeemed Oct 6, valid until Jan 4, 2027
3. [ ] Share the hackathon on social media for bonus units (500 per platform, up to +1,000 per team).
       Rules (form https://forms.gle/BJd5gPzF6YqPQR4R8): LinkedIn, YouTube, Facebook, IG or Threads;
       tag @YouCam API, name the YouCam APIs used, include "Received API credits for sharing", public
       for 30+ days, account created before Sep 24, 2026; one reward per platform per team; form by Nov 2.
       Plan: LinkedIn text post now (+500), the YouTube demo video (task 24) later (+500)
3a. [ ] Ask the organisers for extra test units (Devpost discussion or contact_event@PerfectCorp.com)
3b. [x] Teammates (Sahni, Suvaani) register on Devpost, join the team, and redeem their own YouCam codes.
        Codes are per registrant and non-transferable; each key analyses only its owner's trial.
        Team has 2 women, so it is eligible for the Women in Tech prize.
        Oct 7: both YouCam keys are in `.env` (`YOUCAM_API_SAHNI_KEY`, `YOUCAM_API_SUVAANI_KEY`) and
        accepted by the API, and all three keys are different. Oct 7: both joined the Devpost team.
        Oct 8: units confirmed, billed analyses ran on each own key (Sahni 16, Suvaani 18). Balance
        left: each checks their YouCam console

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
6. [x] **Day-0 photo on Oct 7 (moved from Oct 3), before the first use**. Done: Sujeet (16:49 IST),
       Sahni (19:00 IST), Suvaani. Then one photo every day
       (before any product, sunscreen on the whole face after). One set per person: `trial-<person>`,
       e.g. `trial-sujeet`, named `day-00`, `day-01`, … automatically by the lab app

**Noise test**
7. [x] In the same setup and sitting, take repeat photos into `noise-<person>` (≥5 each). Done:
       Sujeet 5, Sahni 5, Suvaani 5 (all passed the gate). Step out of frame and back between shots ("Fresh shots" in the lab enforces it)
8. [x] API tested Oct 6 on 2 faces (photos now in `photos/_retired/api-test/`): works, raw scores 0–100, higher looks better, `ui_score` differs a lot from raw. Face <60% width is rejected. Units per analysis: 14 (task 4)
8a. [x] `python scripts/noise_test.py photos/noise-sujeet --split --limit 2`: does YouCam accept the
       mirrored half-faces? If yes, run the full `--split` set and record the `L-R` floor too
9. [x] Run the full noise test and record the noise floor per concern below. Done for all three
       (split). Sahni's shot-02 was retaken Oct 8, 00:38 IST (the first one's right half was too dark)
10. [x] **Go/no-go:** (Oct 7: go, with the changes in the finding below) go if the claimed concern's noise floor is small next to a realistic change
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

## Oct 6 – 20 · Core, checkpoints, receipt → M2, M3, M4
12. [x] Choose backend and web stack, and record them in `ARCHITECTURE.md` (Oct 6: FastAPI + React/Vite, as Ringproof)
13. [x] Analyzer module with local result cache (`app/analyzer.py`, shared with the noise script)
14. [x] Direction of `raw_score`: higher is better for every concern (YouCam docs, Oct 7). Shown as ↑
        on every score column; changes are coloured ▲ better / ▼ worse only beyond the noise floor
15. [x] Verdict engine with the noise-floor rule (pure function, VISION D1). Oct 7: `app/verdict.py`,
        tests in `tests/`, verdict on each Today card, claimed concerns per trial (Person → Edit).
        Baseline = day-00 + repeat photos; checkpoint = every analysed photo of the latest day
15b. [x] Checkpoint of 3 photos (Oct 8): on day 7, 14 and 21 the lab names them `day-07`, `day-07b`,
        `day-07c`, turns on "Step out between shots", shows 1/3 → 3/3 on Today, stops the camera at
        3/3, and the verdict averages them (tests in `tests/test_checkpoints.py`)
15c. [x] Direction confirmed (task 14): the verdict's higher-is-better default is correct
15a. [x] `trial.json` per trial: product, claim, treated side, start date (VISION D3). Lab is now organised by person: Today screen, person picker, day numbers from day 0, Retake
16. [ ] Capture gate: brightness + face framing/pose (MediaPipe), day-0 ghost overlay
    - [x] Built in the lab app (`web/src/lib/gate.ts`): Capture, Upload and Results screens. Checked on
          the 2 test photos via Upload; flags uneven light and off-centre nose correctly
    - [x] Test the live camera on the laptop and on the phone (`npm run dev:phone`)
    - [x] Oct 7 fixes: same-camera and light-direction checks vs day 0, phone full-screen capture,
          day-0 camera picked automatically, Wi-Fi lock with QR unlock, fingerprint mismatch badge,
          notes field separate from the claim, test sets billed to their owner
    - [x] Oct 7: background removed from every photo shown in the lab and on other devices
          (originals stay on the PC, never sent to phones); countdown no longer restarts on one
          jittery frame; "Matches day 0" is optional (recorded, not blocking); the Test kind is removed
          (4 repeat photos had landed there by mistake); photos are Daily check-in or Repeat photos only
    - [x] Oct 8: View (full size) and Download on each photo in Results (the background-free copy);
          camera no longer fails with "play() was interrupted" when it is started twice; "Install app"
          in the top bar (Chrome prompt; iPhone: Share → Add to Home Screen); Today shows the latest
          check-in beside day 0, each with its passed/failed badge; the analyse confirm names whose key pays ("Sahni's key", "the main key");
          "Same distance as day 0" (±8% face width) is now a required check; the verdict counts only
          checkpoint days (an analysed day 1 no longer shows Better/Worse); `.gitignore` anchors
          `/photos/` and `/results/` (the Results page source had been ignored), build caches removed
    - [x] Thresholds checked Oct 8 on all 21 saved photos (3 day-00, 3 day-01, 15 repeats): every
          required check passes and no limit needed changing. Closest margins: roll 3.9° (limit 4°),
          light balance 9.7% (limit 10%, Suvaani's day-00). Within one sitting face width varied up
          to 0.05 and chin angle up to 0.05, so the required distance check (±0.08) holds and the
          optional chin match (±0.04) only advises. Sahni's day-01 (77% vs 58%) is the kind of
          drift the distance check now blocks
16a. [x] Open the lab from anywhere (README "Open it from anywhere"). Oct 7: live at
       claimtoglow.kharidwise.com through a Cloudflare Tunnel, Access policy with the team emails,
       then the lab token; `PUBLIC_URL` in `.env`
17. [ ] Keep daily photos going until day 21 (Oct 28)
18. [ ] Analyse each checkpoint the same day (Oct 14, 21, 28) to catch setup problems early
20. [x] Claim agent: claim text → `{ concerns[], deadline_days }`. Oct 7: built (`app/llm.py`, `app/claim.py`,
        "Suggest from claim" in Person → Edit). Tested live on Groq, Gemini and NVIDIA. Real claims:
        face wash (full product page) → radiance, texture, moisture (all 3 models agree; set for Sujeet and
        Sahni); Demelan+ → age_spot, radiance (Suvaani's trial stays on dark circles, off-label)
21. [x] Timeline screen (Oct 8): per claimed concern, a chart of treated − control since baseline
        with the single-photo noise band and the checkpoint the verdict used; table of every
        check-in with capture check and SHA-256 (`app/receipt.py`, Timeline page)
22. [x] Receipt page with photo hashes, plus the badge snippet (Oct 8): face-free record,
        `receipt_hash` over canonical JSON, SVG badge, print layout; tests in `tests/test_receipt.py`
23. [x] Public demo link for judges (Oct 9): https://claimtoglow.kharidwise.com/demo/, read-only,
        no photos. `npm run build:demo` once; the API serves live, face-free data (`app/demo.py`).
        Cloudflare Access bypasses only the path `demo`; the lab still needs the team login.
        Checked Oct 9 from outside: /demo 200, lab and /api redirect to the login. Added to
        Devpost "Try it out". The PC, API and tunnel must stay on through judging (Nov 3–20)
23b. [x] Daily reminder (Oct 11): Today card → "Daily reminder" adds the remaining check-ins to the
        phone's calendar at 7 PM by default, 7 AM in one tap, or any time (the button fits the device: .ics on iPhone, Google Calendar link on
        Android, both on a computer). Checkpoint days get their own event. No email/SMS service; links carry no token.
        The chosen time is saved per person (trial.json) and shown on the card
23c. [x] Sign-in and admin page (Oct 11): Google, GitHub, LinkedIn, email link (Resend) and username/email + password,
        invite-only (ADMIN_EMAILS + admin page). Admin: trials, YouCam usage per key, users, access
        log, settings (other devices: lab link or sign-in, or sign-in only). Stdlib only (sqlite3,
        scrypt, urllib); lab.db git-ignored. Lab links keep working, so the trial isn't affected.
        Keys copied from kharidwise (.env). To do (you): add the claimtoglow callback URL to the Google
        client and LinkedIn app, a new GitHub OAuth app, then restart (README: Sign-in)
23d. [x] Theme switch (Oct 12): System / Light / Dark in the account menu (the demo: in the footer),
        saved per browser, applied before the first paint (index.html) so dark never flashes light
23e. [x] Receipt redesign (Oct 12): verdict first, noise-band bar per concern, "Check it yourself" steps
        (certutil / shasum) with the hashes; Results photo cards show optional checks as grey advice, not red

23f. [x] Noise between days (Oct 13): days 0–5 showed T − C moving 1.1–10× more from day to day than
        within one sitting (Sujeet's texture: +2, +3, −2, −22, +21, +28 vs repeat SD 1.5), so the old floor
        would have called noise a result. The verdict now adds the between-day SD from successive daily
        photos: floor = 2·√(SDw²·(1/k + 1/k0) + 2·SDb²), needs ≥ 4 analysed days. Bands today: Sujeet
        radiance 14, texture 42, moisture 13; Sahni 8, 11, 16; Suvaani dark circles 15. Also seen:
        Sujeet's photo time drifted 16:08–21:56 IST; keep every photo near day 0's time

23h. [x] Cloudflare Access login removed (Oct 13; Access application deleted in the Zero Trust
        dashboard). The app's own lock was checked first (ARCHITECTURE: Access). Checked after, from
        outside: `/`, `/demo/` and `/demo/data` 200 with no login; `/api` 401; original photos 403
23i. [x] Faster photos (Oct 15): lists and cards load a 480 px thumbnail of the background-free
        copy (~42 KB instead of ~414 KB, `_mask/thumb/`, made on first use and with each new mask);
        View and Download keep the full copy. Background-free URLs carry `?v=` and are kept by the
        browser for good (private, never Cloudflare), so a reload doesn't fetch them again.
        Scores, originals and data stay no-store (tests in `tests/test_masking.py`)
23j. [x] Late checkpoint (Oct 23): day 14 was missed by everyone (no photos days 11-15). A missed
        checkpoint is made up only on a day listed in trial.json `late_checkpoints` (`{"16": 14}`
        for all three, `trials.checkpoint_for`): day 16 takes 3 photos and the verdict counts it "for day 14";
        timeline and receipt say so. Photo names keep their real day, so the dates stay true.
        Also Oct 15-17: photos saved after midnight were renamed to the day they belonged to
        (Sahni day-09 → 08, Sahni and Suvaani day-10 → 09)
23k. [x] UI fixes (Oct 23): the Today card and receipt say "Next checkpoint: day 21" once a
        checkpoint day's 3 photos are taken (not "checkpoint today"); the timeline chart shades days
        with no photo ("no photos", days 11-15). App shell: hashed build files are kept for good,
        pages are re-checked on every load (`main.public_cache`), so a rebuild shows without a hard reload
23g. [x] `npm run local` (Oct 13): one command to set up, clean, test, type-check, build both apps and
        serve on :8000; `npm run local:tunnel` adds the Cloudflare tunnel

## Oct 23 – 31 · Final checkpoint, then submit → M5, M6
19. [ ] Analyse the day-14 checkpoint (Oct 21), then the final day-21 checkpoint (Oct 28)
24. [ ] Demo video (1–3 min): claim on the box → split-face trial → verdict, uploaded to YouTube. **Due Oct 30**
25. [ ] Devpost text: problem, differentiation, how YouCam is used, why `raw_score` + noise floor. **Due Oct 30**
        Oct 8: draft in `docs/DEVPOST.md`; project created on Devpost (draft, overview saved)
26. [ ] Make the repo public (or share it with contact_event@PerfectCorp.com). **Due Oct 30**
27. [ ] Final check against the rules, then submit. **Due Oct 31**
28. [ ] Day-21 final verdict into the receipt and the Devpost text. **Due Oct 29**
