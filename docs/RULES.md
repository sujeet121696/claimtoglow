# Rules

> How we write code and work in this repo.

## 1. Code

- Build the smallest thing that demos well. This is a solo, time-split hackathon build.
- Measure with `raw_score`, never `ui_score`.
- Cache every YouCam result locally. Results expire after 24 hours and every success costs units.
- LLM calls go through the provider layer. Never call a provider SDK directly.
- The claim agent and the verdict engine return structured output, never free text.

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

## 3. Secrets and data

- Keys live in `.env`. Commit only `.env.example`.
- Photos stay out of git (`photos/` and `results/` are ignored). Use only your own face or
  consented volunteers.

## 4. Workflow

- **Never commit or push.** The user commits manually.
- Update `TASKS.md` as tasks start and finish.
- Update `ARCHITECTURE.md` when the stack or modules change, and `PRD.md` when scope changes.
- Ringproof comes first until Oct 29.

## 5. Hackathon compliance

- Integrate ≥1 YouCam API with real consumer/retail value.
- Demo video 1–3 min, public on YouTube.
- If the repo is private, share it with contact_event@PerfectCorp.com.
