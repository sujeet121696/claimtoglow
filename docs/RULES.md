# Rules

> How we write code and work in this repo.

## 1. Code

- Build the smallest thing that demos well. This is a solo, time-split hackathon build.
- Measure with `raw_score`, never `ui_score`.
- Cache every YouCam result locally. Results expire after 24 hours and every success costs units.
- LLM calls go through the provider layer. Never call a provider SDK directly.
- The claim agent and the verdict engine return structured output, never free text.
- The verdict math lives only in `app/verdict.py`. The UI draws what the API returns (`floor`,
  `band`) and never recomputes it. A change to the math also updates its tests, the receipt's
  `method` text and the formula in DEVPOST.md.
- Noise counts within a sitting **and** between days (Oct 13: days moved up to 10× more). Never
  judge a change against repeat photos alone.

**Frontend structure** (`web/src`, see ARCHITECTURE.md):
- Each screen is a folder in `features/` with a thin `*Page.tsx` (reads store and URL) and
  reusable parts (e.g. `Camera`, `Uploader`) that take plain props.
- Every page is `PageHeader` + `Card`s. Use the shared components before writing new markup.
- Colours, spacing and radii come from `styles/tokens.css` only. Feature CSS sits next to the feature.
- Domain rules (set names, kinds, labels) live in `domain/trial.ts`, API calls in `api/client.ts`.
- New screen: add it to `PAGES` in `app/router.ts` and `VIEWS` in `app/App.tsx`.

## 2. Wording

- Say "cosmetic skin metrics" and "observed change". Never "diagnose", "treat" or "clinically
  proven".
- Always show "not enough evidence" as an honest outcome, not a failure.
- Any public page that names a product with a verdict says it's one person's cosmetic scores, not
  medical advice and not a judgement of the product for anyone else (receipt page).

## 3. Secrets, data and security

- Keys live in `.env`. Commit only `.env.example`. No secret ever goes in `web/` (anything in the
  built app is public); the browser talks only to our API.
- Photos stay out of git (`photos/` and `results/` are ignored). Use only your own face or
  consented volunteers.
- Faces go only to YouCam. Never to an LLM, a log, an email or `/demo/`. The demo and receipt are
  face-free and carry no notes or key names (`app/demo.py`).
- `/api` and `/files` are locked by the middleware in `app/main.py`. A new open path (`OPEN_PATHS`)
  needs a reason; admin routes always need an admin session; sign-in and admin changes need a
  same-site `Origin`. Keep `Cache-Control: no-store` on private responses.
- Don't trust input: check person and set names, file names and concerns against the allowed lists.
- Pin dependency versions. Before submitting: `npm audit --omit=dev`, `pip-audit -r requirements.txt`
  and a secret scan (`detect-secrets scan`). Oct 13: all three clean, git history too.
- YouCam analyses cost units from a fixed budget: never run one (lab Analyse, `noise_test.py`)
  without the owner's OK. Cached results are free to read.

## 4. Workflow

- **Never commit or push.** The user commits manually.
- Before handing back a change: `python -m unittest discover -s tests` and `cd web && npx tsc --noEmit`
  both pass (`npm run local` runs both, builds, then serves). Read back from real (cached) data where it helps; say what wasn't checked.
- The running lab picks up changes only after an API restart and `npm run build` (+ `build:demo`).
- Update `TASKS.md` as tasks start and finish.
- Update `ARCHITECTURE.md` when the stack or modules change, and `PRD.md` when scope changes.
- Submit by Oct 26, one week before the deadline; only the day-21 verdict comes after (by Oct 29).

## 5. Trial protocol

- Each photo near that person's day-0 time, same camera, spot and light (Sujeet ~16:50 IST,
  Sahni ~19:00 IST). Drift to night light caused the worst outliers in week 1.

## 6. Hackathon compliance

- Integrate ≥1 YouCam API with real consumer/retail value.
- Demo video 1–3 min, public on YouTube.
- If the repo is private, share it with contact_event@PerfectCorp.com.
