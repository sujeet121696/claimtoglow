// Receipt: the face-free record of one trial (app/receipt.py). Anyone holding the original photos
// can recompute each SHA-256 and check that the result rests on exactly these files. The badge links
// a product page back to this receipt.
import { useState } from "react";
import { DEMO } from "../../app/mode";
import { href } from "../../app/router";
import { useStore } from "../../app/store";
import { api } from "../../api/client";
import type { Receipt, ReceiptPhoto } from "../../api/types";
import { Badge, Card, PageHeader } from "../../components/ui";
import { CHANGE, concernLabel, personLabel, savedAt, sideLabel, statusTone } from "../../domain/trial";
import { useLoad } from "../../hooks/useLoad";
import "./receipt.css";

export function ReceiptPage() {
  const { person, version } = useStore();
  const id = person?.person;
  const { data, error } = useLoad(id ? () => api.receipt(id) : null, [id, version]);
  if (!person) return null;
  return (
    <>
      <PageHeader
        title="Receipt"
        description="Everything needed to check this result. No photos: each one is listed by its SHA-256 fingerprint."
        actions={<button onClick={() => window.print()}>Print</button>}
      />
      {error && <p className="error">{error}</p>}
      {data && (
        <div className="receipt">
          <ClaimCard r={data} />
          <VerdictCard r={data} />
          <PhotosCard r={data} />
          <Card title="Receipt fingerprint">
            <p className="mono hash">{data.receipt_hash}</p>
            <p className="small muted">
              SHA-256 of this receipt's data (canonical JSON, without the time it was generated: {savedAt(data.generated_at)}).
              The same trial data always gives the same value; any edit to the claim, verdict or photo list changes it.
            </p>
            <p className="small muted">Method: {data.method}</p>
          </Card>
          <BadgeCard r={data} />
        </div>
      )}
    </>
  );
}

function ClaimCard({ r }: { r: Receipt }) {
  const rows: [string, string][] = [
    ["Product", r.product || "–"],
    ["Claim", r.claim ? `“${r.claim}”` : "–"],
    ["Claimed concerns", r.concerns.map(concernLabel).join(", ") || "–"],
    ["Tested by", personLabel(r.person)],
    ["Treated side", `${sideLabel(r.treated_side)}; the other half is the control`],
    ["Day 0", r.start_date ?? "–"],
    ["Length", `${r.duration_days} days, checkpoints on day 7, 14 and ${r.duration_days}`],
  ];
  return (
    <Card title="Claim">
      <dl className="facts">
        {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}
      </dl>
    </Card>
  );
}

function VerdictCard({ r }: { r: Receipt }) {
  const v = r.verdict;
  return (
    <Card title="Verdict" actions={<Badge tone={statusTone(v.status)}>{v.status}</Badge>}>
      <p>{v.reason}{v.checkpoint_day !== null && <span className="muted"> Latest checkpoint: day {v.checkpoint_day}.</span>}</p>
      {v.concerns.length > 0 && (
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th scope="col">Concern</th><th scope="col">Change</th><th scope="col">Noise floor</th><th scope="col">Photos (checkpoint / baseline)</th><th scope="col">Result</th></tr>
            </thead>
            <tbody>
              {v.concerns.map((c) => {
                const change = CHANGE[c.result];
                return (
                  <tr key={c.concern}>
                    <th scope="row">{concernLabel(c.concern)}</th>
                    <td>{c.effect !== undefined ? `${c.effect > 0 ? "+" : ""}${c.effect.toFixed(2)}` : "–"}</td>
                    <td>{c.floor !== undefined ? `±${c.floor.toFixed(2)}` : "–"}</td>
                    <td>{c.k} / {c.k0}</td>
                    <td><span className={`change ${change.tone}`}>{change.icon} {change.label}</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}

function PhotoRows({ photos }: { photos: ReceiptPhoto[] }) {
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

function PhotosCard({ r }: { r: Receipt }) {
  const changed = [...r.photos.daily, ...r.photos.repeat].filter((p) => p.tampered).length;
  return (
    <Card title="Photos" actions={<span className="small muted">{r.photos.daily.length} check-ins · {r.photos.repeat.length} repeat photos</span>}>
      <p className="small muted">
        {changed ? `${changed} file(s) changed since capture.` : "Every file still matches the fingerprint taken at capture."}
      </p>
      <PhotoRows photos={r.photos.daily} />
      <details className="repeat-photos">
        <summary>Repeat photos (noise test)</summary>
        <PhotoRows photos={r.photos.repeat} />
      </details>
    </Card>
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
