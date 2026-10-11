# Claim to Glow

**Every skincare claim, put to the test.**

Skincare brands promise "visible results in 14 days" and prove it with before/after photos taken
under different light, angles and filters. Claim to Glow checks the claim on your own skin:

1. **Claim in:** an agent turns the marketing claim into measurable skin metrics and a deadline.
2. **Fair check-ins:** each photo is gated on lighting, framing and pose so it matches day 0.
3. **Measurement:** YouCam Skin Analysis scores every check-in.
4. **Honest verdict:** only changes bigger than the measured noise floor count. The result is
   "claim met", "not met" or "not enough evidence".
5. **Receipt:** a public result page with a fingerprint of every photo, so it can't be quietly edited.

## Why it's different

| | Skin-scanner apps | Research-grading sites | Photo diaries | **Claim to Glow** |
|---|---|---|---|---|
| Starts from a product claim | – | ✓ | – | ✓ |
| Measures *your* skin | ✓ | – | – | ✓ |
| Separates real change from noise | – | – | – | ✓ |
| Blocks unfair photos | – | – | Partly | ✓ |
| Tamper-evident result | – | – | – | ✓ |

Skin apps tell you your score. Claim to Glow tells you whether the product kept its promise, and
only when the evidence is strong enough to say so.

> Built for the **YouCam API Skin AI & eCommerce VTO Hackathon** by Perfect Corp.
> Status: **trials running** since Oct 7, 21 days (lab, capture gate, noise test, verdict engine,
> claim agent, hosting, checkpoints, timeline, receipt and judge demo done). Submitting by Oct 26; deadline Nov 2, 2026.

## Run locally

```sh
cp .env.example .env                      # add your YouCam API key (and teammates' keys)
python -m venv .venv
.venv/Scripts/pip install -r requirements.txt   # macOS/Linux: .venv/bin/pip
.venv/Scripts/python -m uvicorn app.main:app --port 8000

cd web && npm install                     # also fetches the MediaPipe model
npm run dev                               # http://localhost:5173 (laptop camera)
npm run dev:phone                         # phone on the same Wi-Fi: Today → "Open on phone" → scan the QR
```

The lab app is organised by person (one trial each; ＋ Add person on Today). Screens:

- **Today:** for each person, today's photo, repeat photos and the day-0 check.
- **Capture:** live camera with the capture gate. The shutter works only when every check passes.
  Auto-capture beeps a countdown for a phone on a stand.
- **Upload:** runs the same gate on photos from the phone's camera app.
- **Results:** analyse a set with YouCam, compare scores and changes against the noise floor.

Photos go to `photos/<set>/` and results to `results/`. Both stay out of git.

## Open it from anywhere (Cloudflare Tunnel)

Teammates can take their daily photos from home. The lab still runs on this PC, photos stay here,
and Cloudflare only forwards the traffic. Needs a domain on Cloudflare (here `kharidwise.com`).

**Once:**

```sh
cloudflared tunnel login                                      # browser: pick the domain
cloudflared tunnel create claimtoglow
```

Create `~/.cloudflared/claimtoglow.yml` (its own file, so another tunnel's `config.yml` isn't used
by mistake):

```yaml
tunnel: <tunnel id from create>
credentials-file: C:\Users\<you>\.cloudflared\<tunnel id>.json
ingress:
  - hostname: claimtoglow.kharidwise.com
    service: http://localhost:8000
  - service: http_status:404
```

```sh
cloudflared --config ~/.cloudflared/claimtoglow.yml tunnel route dns --overwrite-dns claimtoglow claimtoglow.kharidwise.com
```

Then, in the Cloudflare dashboard → Zero Trust → Access → Applications, add a **self-hosted** app for
`claimtoglow.kharidwise.com` with an **Allow** policy listing only the team's emails. Add
`PUBLIC_URL=https://claimtoglow.kharidwise.com` to `.env`.

**Each time:**

```sh
cd web && npm run build                                       # after any web change
.venv/Scripts/python -m uvicorn app.main:app --port 8000      # serves the API and the built app
cloudflared --config ~/.cloudflared/claimtoglow.yml tunnel run
```

Share the lab: Today → "Open on phone" → **Anywhere** → scan or Copy link. Two locks protect it:
Cloudflare Access (team emails only) and the lab token in that link (or a sign-in, see below).

## Sign-in and admin page

Optional on top of Cloudflare Access and the lab link: team accounts, and an admin page
(account menu → Admin) with every trial, YouCam usage per key, users, the access log and settings.
Invite-only: the emails in `ADMIN_EMAILS` are admins; everyone else is added on the admin page.
Accounts, sessions and the log live in `lab.db` (git-ignored); passwords are stored as scrypt hashes.

**Once:**

1. Add your email to `.env`: `ADMIN_EMAILS=you@example.com` (comma-separated for more owners).
2. Either add yourself with a password (works without any provider):
   `.venv/Scripts/python -m app.users add you@example.com --username you --admin`
   or set up one or more providers below and sign in with them.
3. Restart the server.

**Providers** (each is offered only when both of its keys are in `.env`). Register this callback URL
with each, for the address you sign in from, e.g. `https://claimtoglow.kharidwise.com/api/auth/callback/google`:

| Provider | Where | `.env` |
|---|---|---|
| Google | Google Cloud Console → APIs & Services → Credentials → OAuth client ID (Web application); the consent screen in Testing mode allows only its listed test users | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` |
| GitHub | GitHub → Settings → Developer settings → OAuth Apps → New (one callback URL per app) | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET` |
| LinkedIn | linkedin.com/developers → Create app → Products: Sign In with LinkedIn using OpenID Connect → Auth: redirect URL | `LINKEDIN_CLIENT_ID`, `LINKEDIN_CLIENT_SECRET` |
| Email link | Resend (resend.com), sender on a verified domain; the link goes to `PUBLIC_URL` when set | `RESEND_API_KEY`, `EMAIL_FROM` |

The keys can be the ones kharidwise uses (same Google, LinkedIn and Resend accounts): add the
claimtoglow callback URL to the existing Google client and LinkedIn app. A GitHub OAuth app has only
one callback URL, so claimtoglow needs its own GitHub app.

An email link is sent only to an invited email, works once for 15 minutes, and needs a press on
"Sign in" (so email scanners can't use it up). A provider signs someone in only when it says the email is verified and that email has an account
(or is in `ADMIN_EMAILS`). A device that isn't let in opens on the sign-in page and returns to where it
was afterwards. Admin → Settings → **Who gets in**: "Lab link or sign-in" (default: this PC opens
freely, phones with the lab link or a sign-in) or "Sign-in only" (every device signs in first, this PC
too; lab links stop working). The admin page always needs a sign-in.
Forgot the password: `.venv/Scripts/python -m app.users password you@example.com`.
Locked out by "Sign-in only": `.venv/Scripts/python -m app.users allow-links`.

## Judge demo (read-only, no faces)

The trial's timeline and receipt with the real scores, but no photos (only their SHA-256
fingerprints). Build the demo app once (again only after a web code change):

```sh
cd web && npm run build:demo        # demo app -> web/dist-demo/
```

The API then serves it at `/demo/` with live data, so it is always current: locally
http://localhost:8000/demo/, publicly https://claimtoglow.kharidwise.com/demo/ once Cloudflare
Access has a **Bypass / Everyone** policy for the path `demo`. Judges can reach it only while this
PC, the API and the tunnel are running. For a static host instead, run
`.venv/Scripts/python scripts/export_demo.py` and upload `web/dist-demo`.

## Noise test

Before trusting any "−18%", measure how much scores move when nothing changed:

```sh
.venv/Scripts/python scripts/noise_test.py photos/noise-sujeet --limit 1   # one photo first
.venv/Scripts/python scripts/noise_test.py photos/noise-sujeet             # the full set (≥5 photos)
.venv/Scripts/python scripts/noise_test.py photos/noise-sujeet --split     # split-face halves
```

See [`docs/TASKS.md`](docs/TASKS.md) for how to take the photos.

## Tests

```sh
.venv/Scripts/python -m unittest discover tests
```

## Docs

| File | Contents |
|---|---|
| [`docs/PRD.md`](docs/PRD.md) | Problem, goals, scope, constraints, risks |
| [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) | Pipeline, YouCam API facts, modules |
| [`docs/RULES.md`](docs/RULES.md) | Coding and workflow rules |
| [`docs/DESIGN.md`](docs/DESIGN.md) | UI/UX direction |
| [`docs/TASKS.md`](docs/TASKS.md) | Build checklist and progress |
| [`docs/DEVPOST.md`](docs/DEVPOST.md) | Devpost submission text |
| [`docs/VISION.md`](docs/VISION.md) | Post-hackathon AI agent and scaling decisions |

## License

MIT
