// Receipt: the face-free record of one trial (app/receipt.py), laid out as a slip you can hand
// someone: the claim, the verdict, one line per claimed concern with its change drawn against the
// noise band, then the test and the fingerprint. Below the slip, the evidence for checking it:
// every photo's SHA-256, so anyone holding the originals can confirm the result rests on exactly
// these files. The badge links a product page back to this receipt.
import { useEffect, useState, type ReactNode } from "react";
import { DEMO } from "../../app/mode";
import { href } from "../../app/router";
import { useStore } from "../../app/store";
import { api } from "../../api/client";
import type { Receipt, ReceiptPhoto, TrialVerdict, VerdictRow, VerdictStatus } from "../../api/types";
import { Card, Clamp, PageHeader } from "../../components/ui";
import { CHANGE, concernLabel, personLabel, savedAt, sideLabel, statusTone } from "../../domain/trial";
import { useLoad } from "../../hooks/useLoad";
import { DayRing, nextCheckpoint } from "../../components/DayRing";
import "./receipt.css";

export function ReceiptPage() {
  const { person, version, today } = useStore();
  const id = person?.person;
  const { data, error } = useLoad(id ? () => api.receipt(id) : null, [id, version]);

  // The evidence is folded away on screen, but a printed receipt must carry all of it.
  useEffect(() => {
    const open = () => document.querySelectorAll<HTMLDetailsElement>(".receipt-page details").forEach((d) => { d.open = true; });
    window.addEventListener("beforeprint", open);
    return () => window.removeEventListener("beforeprint", open);
  }, []);

  if (!person) return null;
  return (
    <div className="receipt-page">
      <PageHeader
        title="Receipt"
        description="A face-free record of this trial that anyone can check."
        actions={<button onClick={() => window.print()}>Print or save PDF</button>}
      />
      {error && <p className="error">{error}</p>}
      {data && (
        <>
          <article className="slip" aria-label="Trial receipt">
            <header className="slip-head">
              <p className="slip-kicker">Claim to Glow · trial receipt</p>
              <h2>{data.product || "Product not set"}</h2>
              {data.claim && <blockquote><Clamp>“{data.claim}”</Clamp></blockquote>}
            </header>
            <Verdict v={data.verdict} day={person.day} duration={data.duration_days} today={today} />
            <Concerns r={data} />
            <Facts r={data} />
            <footer className="slip-foot">
              <span className="slip-label">Receipt fingerprint (SHA-256)</span>
              <span className="mono hash">{data.receipt_hash}</span>
              <span className="small muted">Generated {savedAt(data.generated_at)}. Any change to the claim, verdict or photo list changes it.</span>
            </footer>
          </article>
          <Evidence r={data} />
          <BadgeCard r={data} />
        </>
      )}
    </div>
  );
}

const HEADLINE: Record<VerdictStatus, string> = {
  met: "Claim held",
  "not met": "Claim did not hold",
  "not enough evidence": "Not proven yet",
};

/** The verdict as a stamp, with where the trial stands. */
function Verdict({ v, day, duration, today }: { v: TrialVerdict; day: number | null; duration: number; today: string }) {
  const ended = day !== null && day > duration;
  // The demo is a snapshot, so it says when, instead of counting days that go stale.
  const upcoming = DEMO ? (day !== null && day >= 0 ? `As of ${today}: day ${day} of ${duration}.` : null) : nextCheckpoint(day, duration);
  return (
    <section className={`slip-verdict ${statusTone(v.status)}`}>
      <DayRing day={day} duration={duration} />
      <div>
        <p className="stamp">{HEADLINE[v.status]}</p>
        <p className="small">
          {v.reason}
          {v.checkpoint_day !== null && ` Based on the day-${v.checkpoint_day} checkpoint.`}
        </p>
        <p className="small muted">{ended ? "Trial complete." : upcoming ?? "Trial not started."}</p>
      </div>
    </section>
  );
}

/** One line per claimed concern: the result in words, and the change drawn against the noise band. */
function Concerns({ r }: { r: Receipt }) {
  const rows = r.verdict.concerns;
  if (!rows.length) return null;
  return (
    <section className="slip-section">
      <h3>What was measured</h3>
      <ul className="lines">
        {rows.map((c) => <ConcernLine key={c.concern} c={c} />)}
      </ul>
      <p className="small muted">
        Change = treated half minus untreated half, compared with day 0. It counts only outside the grey band:
        how far the score moves between repeat photos taken minutes apart, plus how far it moves from one day
        to the next with light and setup alone.
      </p>
      <p className="small muted">
        One person, one product, YouCam's cosmetic skin scores. A record of this trial, not medical advice and
        not a judgement of the product for anyone else.
      </p>
    </section>
  );
}

function ConcernLine({ c }: { c: VerdictRow }) {
  const { effect, floor } = c;
  const change = CHANGE[c.result];
  return (
    <li>
      <span className="line-name">{concernLabel(c.concern)}</span>
      {effect === undefined || floor === undefined ? (
        <span className="line-note muted small">Not measured yet: waits for a checkpoint</span>
      ) : (
        <>
          <NoiseBar effect={effect} floor={floor} />
          <span className={`change ${change.tone}`}>{change.icon} {change.label}</span>
          <span className="line-numbers small muted">
            {effect > 0 ? "+" : ""}{effect.toFixed(1)} vs noise ±{floor.toFixed(1)} · {c.k} checkpoint / {c.k0} baseline photos
          </span>
        </>
      )}
    </li>
  );
}

/** A dot for the change on a line centred on 0, with the noise band shaded around it. */
function NoiseBar({ effect, floor }: { effect: number; floor: number }) {
  const span = Math.max(Math.abs(effect), floor) * 1.4 || 1;
  const pos = (x: number) => `${50 + (x / span) * 50}%`;
  return (
    <span className="noise-bar" role="img" aria-label={`Change ${effect.toFixed(1)}, noise band ±${floor.toFixed(1)}`}>
      <span className="band" style={{ left: pos(-floor), right: `calc(100% - ${pos(floor)})` }} />
      <span className="zero" />
      <span className={`dot ${Math.abs(effect) > floor ? (effect > 0 ? "better" : "worse") : ""}`} style={{ left: pos(effect) }} />
    </span>
  );
}

function Facts({ r }: { r: Receipt }) {
  const all = [...r.photos.daily, ...r.photos.repeat];
  const changed = all.filter((p) => p.tampered).length;
  const rows: [string, ReactNode][] = [
    ["Tested by", personLabel(r.person)],
    ["Treated side", `${sideLabel(r.treated_side)}; the other half is the control`],
    ["Day 0", r.start_date ?? "–"],
    ["Length", `${r.duration_days} days; checkpoints on day 7, 14 and ${r.duration_days}`],
    ["Photos", `${r.photos.daily.length} check-ins and ${r.photos.repeat.length} repeat photos`],
    ["Files", changed
      ? <span className="fail">{changed} changed since capture</span>
      : <span className="pass">✓ All {all.length} unchanged since capture</span>],
  ];
  return (
    <section className="slip-section">
      <h3>The test</h3>
      <dl className="facts">
        {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
    </section>
  );
}

/** How to check the receipt, and every photo's fingerprint. */
function Evidence({ r }: { r: Receipt }) {
  return (
    <Card title="Check it yourself">
      <ol className="check-steps small">
        <li>Ask the tester for the original photo files (they never leave the tester's computer).</li>
        <li>Compute each file's SHA-256 (Windows: <code>certutil -hashfile day-00.jpg SHA256</code>; Mac or Linux: <code>shasum -a 256 day-00.jpg</code>).</li>
        <li>Each value must match the list below. Any change to a file, even re-saving it, gives a completely different value.</li>
      </ol>
      <details className="evidence">
        <summary>Check-in photos ({r.photos.daily.length})</summary>
        <PhotoRows photos={r.photos.daily} />
      </details>
      <details className="evidence">
        <summary>Repeat photos for the noise band ({r.photos.repeat.length})</summary>
        <PhotoRows photos={r.photos.repeat} />
      </details>
      <details className="evidence">
        <summary>Method</summary>
        <p className="small">{r.method}</p>
      </details>
    </Card>
  );
}

function PhotoRows({ photos }: { photos: ReceiptPhoto[] }) {
  if (!photos.length) return <p className="small muted">None yet.</p>;
  return (
    <div className="table-wrap">
      <table className="photo-hashes">
        <thead>
          <tr><th scope="col">Photo</th><th scope="col">Saved</th><th scope="col">Capture check</th><th scope="col">SHA-256</th></tr>
        </thead>
        <tbody>
          {photos.map((p) => (
            <tr key={p.stem}>
              <th scope="row">{p.stem}</th>
              <td>{savedAt(p.saved_at)}</td>
              <td>
                {p.gate_passed == null ? "unchecked" : p.gate_passed ? "passed" : `failed: ${p.failed.join(", ")}`}
                {p.tampered && <> · <span className="fail">file changed since capture</span></>}
              </td>
              <td className="mono">{p.sha256}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BadgeCard({ r }: { r: Receipt }) {
  const [copied, setCopied] = useState(false);
  const badge = api.badgeUrl(r.person);
  const page = new URL(href("receipt", { person: r.person }), window.location.href).href;
  const snippet = `<a href="${page}"><img src="${new URL(badge, window.location.href).href}" alt="Claim to Glow: ${r.verdict.status}"></a>`;
  const copy = () => navigator.clipboard.writeText(snippet).then(() => setCopied(true)).catch(() => setCopied(false));
  return (
    <Card title="Badge for a product page" className="no-print">
      <p className="small muted">Links shoppers from the product page to this receipt, so the claim comes with its evidence.</p>
      <img src={badge} alt={`Claim to Glow: ${r.verdict.status}`} />
      {DEMO ? (
        <>
          <textarea className="mono snippet" readOnly rows={3} value={snippet} onFocus={(e) => e.currentTarget.select()} />
          <button onClick={copy}>{copied ? "Copied ✓" : "Copy snippet"}</button>
        </>
      ) : (
        <p className="small muted">
          The embeddable snippet points at the published demo (scripts/export_demo.py), since the lab itself is private.
        </p>
      )}
    </Card>
  );
}
