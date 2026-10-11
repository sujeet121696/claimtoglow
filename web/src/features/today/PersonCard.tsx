import { href } from "../../app/router";
import { useStore } from "../../app/store";
import type { Person } from "../../api/types";
import { Badge } from "../../components/ui";
import { CHANGE, concernLabel, dayStem, personLabel, sideShort, statusTone, type Kind } from "../../domain/trial";
import { DayRing, nextCheckpoint } from "./DayRing";
import { Reminder } from "./Reminder";

const GateBadge = ({ passed }: { passed: boolean | null | undefined }) =>
  passed == null ? <Badge tone="neutral">checking</Badge>
    : passed ? <Badge tone="pass">passed</Badge>
    : <Badge tone="fail">failed</Badge>;

function dayText(p: Person) {
  if (p.day === null) return "No day 0 set";
  if (p.day < 0) return `Starts in ${-p.day} days`;
  if (p.day > p.duration_days) return `Finished · ${p.duration_days} days`;
  return `Day ${p.day} of ${p.duration_days}`;
}

export function PersonCard({ person: p }: { person: Person }) {
  const { selectPerson, edit } = useStore();
  const noiseDone = p.noise_count >= p.noise_target;
  const checkpoint = p.today_target > 1; // day 7, 14, 21: three fresh photos, averaged
  const upcoming = nextCheckpoint(p.day, p.duration_days);
  // Same time of day as day 0 means the same light.
  const day0Time = p.day0?.saved_at
    ? new Date(p.day0.saved_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })
    : null;

  const Actions = ({ kind }: { kind: Kind }) => (
    <span className="task-actions">
      {(["capture", "upload"] as const).map((page) => (
        <a key={page} className="button small" href={href(page, { kind })} onClick={() => selectPerson(p.person)}>
          {page === "capture" ? "Camera" : "Upload"}
        </a>
      ))}
    </span>
  );

  return (
    <article className="card person-card">
      <header className="person-head">
        <DayRing day={p.day} duration={p.duration_days} />
        <div>
          <h2>{personLabel(p.person)}</h2>
          <p className="muted small">{p.product || "No product set"}</p>
          <p className="small muted">{dayText(p)} · treated {sideShort(p.treated_side)}</p>
        </div>
        <button className="ghost" onClick={() => edit(p)}>Edit</button>
      </header>
      {upcoming && <p className="next-checkpoint small">{upcoming}</p>}

      <ul className="tasks">
        {p.today_target > 0 && (
          <li>
            <span className={p.today_done ? "pass" : "todo"} aria-hidden>{p.today_done ? "✓" : "○"}</span>
            <span>
              {checkpoint ? `Checkpoint · ${p.today_count}/${p.today_target} photos` : "Today's photo"}
              {p.day !== null && p.day >= 0 ? ` · ${p.today_next ?? dayStem(p.day)}` : ""}
              {day0Time && !p.today_done && <span className="muted small"> · around {day0Time}</span>}
              {checkpoint && !p.today_done && <span className="muted small"> · step out of frame between shots</span>}
            </span>
            {!p.today_done && <Actions kind="trial" />}
          </li>
        )}
        <li>
          <span className={noiseDone ? "pass" : "todo"} aria-hidden>{noiseDone ? "✓" : "○"}</span>
          <span>Repeat photos · {p.noise_count}/{p.noise_target}</span>
          {!noiseDone && <Actions kind="noise" />}
        </li>
      </ul>
      <Reminder person={p} />

      <div className="verdict small">
        <b>Verdict</b>
        <Badge tone={statusTone(p.verdict.status)}>{p.verdict.status}</Badge>
        <span className="muted">{p.verdict.reason}</span>
      </div>
      {p.verdict.concerns.length > 0 && (
        <ul className="concern-changes small">
          {p.verdict.concerns.map((c) => {
            const change = CHANGE[c.result];
            return (
              <li key={c.concern}>
                <span>{concernLabel(c.concern)}</span>
                <span className={`change ${change.tone}`}>
                  {change.icon} {change.label}
                  {c.effect !== undefined && ` · ${c.effect > 0 ? "+" : ""}${c.effect.toFixed(1)} (noise ±${c.floor?.toFixed(1)})`}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {p.day0 ? (
        <div className={`day0 ${p.latest ? "with-latest" : ""}`}>
          <img src={p.day0.masked_url ?? p.day0.url} alt={`${personLabel(p.person)}, day 0`} />
          <div className="small">
            <div className="day0-title">
              <b>Day 0</b>
              <GateBadge passed={p.day0.gate_passed} />
            </div>
            {p.day0.gate_passed === false && (
              <p className="muted">
                {p.day0.failed.join(", ")}. <a href={href("results", { set: `trial-${p.person}` })} onClick={() => selectPerson(p.person)}>Retake</a> before the first use if you still can.
              </p>
            )}
          </div>
          {p.latest && (
            <>
              <img src={p.latest.masked_url ?? p.latest.url} alt={`${personLabel(p.person)}, ${p.latest.stem}`} />
              <div className="small">
                <div className="day0-title">
                  <b>Latest</b>
                  <GateBadge passed={p.latest.gate_passed} />
                </div>
                <p className="muted">
                  {p.latest.stem}
                  {p.latest.gate_passed === false && (
                    <> · {p.latest.failed.join(", ")}. <a href={href("results", { set: `trial-${p.person}` })} onClick={() => selectPerson(p.person)}>Retake</a></>
                  )}
                </p>
              </div>
            </>
          )}
        </div>
      ) : (
        <p className="muted small">No day-0 photo yet. Take it before the first use.</p>
      )}
    </article>
  );
}
