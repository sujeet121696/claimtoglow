// Timeline: the whole trial for one person. Per claimed concern, a chart of the change since
// baseline against the noise band; below, every check-in with its capture check and fingerprint.
import { href } from "../../app/router";
import { useStore } from "../../app/store";
import { api } from "../../api/client";
import type { Timeline, TimelineEntry } from "../../api/types";
import { Badge, Card, Clamp, Empty, PageHeader } from "../../components/ui";
import { CHANGE, changeResult, concernLabel, personLabel, savedAt, sideShort, statusTone } from "../../domain/trial";
import { useLoad } from "../../hooks/useLoad";
import { TrendChart } from "./TrendChart";
import "./timeline.css";

export function TimelinePage() {
  const { person, version } = useStore();
  const id = person?.person;
  const { data, error } = useLoad(id ? () => api.timeline(id) : null, [id, version]);
  if (!person) return null;

  const days = data?.entries.filter((e) => e.day !== null && e.day > 0 && !/[b-z]$/.test(e.stem)).length ?? 0;
  return (
    <>
      <PageHeader
        title="Timeline"
        description={<><b>{personLabel(person.person)}</b> · {person.product || "no product set"} · treated {sideShort(person.treated_side)}
          {person.claim && <><br /><Clamp><span className="small">Claim: “{person.claim}”</span></Clamp></>}</>}
        actions={<a className="button" href={href("receipt", { person: person.person })}>Receipt</a>}
      />
      {error && <p className="error">{error}</p>}
      {data && (
        <>
          <Card>
            <div className="verdict">
              <b>Verdict</b>
              <Badge tone={statusTone(data.verdict.status)}>{data.verdict.status}</Badge>
              <span className="muted">{data.verdict.reason}</span>
            </div>
            <p className="small muted timeline-meta">
              Day 0 {data.start_date ?? "not set"} · {days} of {data.duration_days} daily check-ins after day 0 ·
              checkpoints on day 7, 14 and {data.duration_days} (3 photos each)
            </p>
          </Card>
          {data.concerns.length ? data.concerns.map((c) => <ConcernCard key={c} concern={c} data={data} />)
            : <Empty>No claimed concerns set yet (Person → Edit).</Empty>}
          <CheckinsCard data={data} />
        </>
      )}
    </>
  );
}

function ConcernCard({ concern, data }: { concern: string; data: Timeline }) {
  const row = data.verdict.concerns.find((r) => r.concern === concern);
  const change = CHANGE[row?.result ?? "unknown"];
  const band = data.band[concern];
  return (
    <Card title={concernLabel(concern)} actions={<span className={`change ${change.tone}`}>{change.icon} {change.label}
      {row?.effect !== undefined && ` · ${row.effect > 0 ? "+" : ""}${row.effect.toFixed(1)} (noise ±${row.floor?.toFixed(1)})`}</span>}>
      <TrendChart concern={concern} entries={data.entries} baseline={data.baseline[concern]} band={band}
        duration={data.duration_days} row={row} checkpointDay={data.verdict.checkpoint_day} />
      <p className="small muted timeline-note">
        Change in treated − control since the baseline ({data.k0} photos: day 0 and the repeat photos); above 0 is better.
        Grey band: what one photo can move by noise alone, within a sitting and between days{band !== null ? ` (±${band.toFixed(1)})` : ""}.
        Diamond: the checkpoint the verdict uses, with its own noise range.
      </p>
    </Card>
  );
}

function CheckinsCard({ data }: { data: Timeline }) {
  const band = (c: string) => data.band[c] ?? undefined;
  const changeOf = (e: TimelineEntry, c: string) => {
    const base = data.baseline[c];
    const v = e.tc?.[c];
    return v === undefined || base === null ? null : v - base;
  };
  return (
    <Card title="Check-ins" actions={<span className="small muted">{data.entries.length} photos</span>}>
      <div className="table-wrap">
        <table className="checkins">
          <thead>
            <tr>
              <th scope="col">Photo</th>
              <th scope="col">Saved</th>
              <th scope="col">Capture check</th>
              {data.concerns.map((c) => <th key={c} scope="col">{concernLabel(c)}</th>)}
              <th scope="col">SHA-256</th>
            </tr>
          </thead>
          <tbody>
            {data.entries.map((e) => (
              <tr key={e.stem} className={e.checkpoint ? "is-checkpoint" : ""}>
                <th scope="row">
                  {e.masked_url && <img src={e.masked_url} alt="" width={28} height={36} />}
                  {e.stem}{e.checkpoint && <span className="muted small"> · checkpoint</span>}
                </th>
                <td>{savedAt(e.saved_at)}</td>
                <td>
                  {e.gate_passed == null ? <Badge tone="neutral">unchecked</Badge>
                    : e.gate_passed ? <Badge tone="pass">passed</Badge>
                    : <Badge tone="fail">failed</Badge>}
                  {e.tampered && <> <Badge tone="fail">file changed</Badge></>}
                </td>
                {data.concerns.map((c) => {
                  const d = changeOf(e, c);
                  if (d === null) return <td key={c} className="muted">not analysed</td>;
                  const text = `${d > 0 ? "+" : ""}${d.toFixed(1)}`;
                  // Colour only checkpoint photos: the verdict judges checkpoints, not single daily photos.
                  if (!e.checkpoint) return <td key={c}>{text}</td>;
                  return <td key={c}><span className={`change ${CHANGE[changeResult(d, band(c))].tone}`}>{text}</span></td>;
                })}
                <td className="mono small" title={e.sha256}>{e.sha256.slice(0, 12)}…</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="small muted timeline-note">
        Changes are against the baseline. Only checkpoints count toward the verdict, so only they are coloured
        (beyond one photo's noise band). Analysed daily photos measure how much scores move between days.
      </p>
    </Card>
  );
}
