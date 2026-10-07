import { href } from "../../app/router";
import { useStore } from "../../app/store";
import type { Person } from "../../api/types";
import { Badge } from "../../components/ui";
import { dayStem, personLabel, sideShort, type Kind } from "../../domain/trial";

function dayText(p: Person) {
  if (p.day === null) return "No day 0 set";
  if (p.day < 0) return `Starts in ${-p.day} days`;
  if (p.day > p.duration_days) return `Finished · ${p.duration_days} days`;
  return `Day ${p.day} of ${p.duration_days}`;
}

export function PersonCard({ person: p }: { person: Person }) {
  const { selectPerson, edit } = useStore();
  const progress = p.day === null ? 0 : Math.min(1, Math.max(0, p.day / p.duration_days));
  const noiseDone = p.noise_count >= p.noise_target;
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
        <div>
          <h2>{personLabel(p.person)}</h2>
          <p className="muted small">{p.product || "No product set"}</p>
        </div>
        <button className="ghost" onClick={() => edit(p)}>Edit</button>
      </header>

      <div>
        <div className="progress" role="progressbar" aria-valuenow={Math.round(progress * 100)} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${progress * 100}%` }} />
        </div>
        <p className="small muted">{dayText(p)} · treated {sideShort(p.treated_side)}</p>
      </div>

      <ul className="tasks">
        <li>
          <span className={p.today_done ? "pass" : "todo"} aria-hidden>{p.today_done ? "✓" : "○"}</span>
          <span>
            Today's photo{p.day !== null && p.day >= 0 ? ` · ${dayStem(p.day)}` : ""}
            {day0Time && !p.today_done && <span className="muted small"> · around {day0Time}</span>}
          </span>
          {!p.today_done && <Actions kind="trial" />}
        </li>
        <li>
          <span className={noiseDone ? "pass" : "todo"} aria-hidden>{noiseDone ? "✓" : "○"}</span>
          <span>Repeat photos · {p.noise_count}/{p.noise_target}</span>
          {!noiseDone && <Actions kind="noise" />}
        </li>
      </ul>

      <div className="verdict small">
        <b>Verdict</b>
        <Badge tone={p.verdict.status === "met" ? "pass" : p.verdict.status === "not met" ? "fail" : "neutral"}>{p.verdict.status}</Badge>
        <span className="muted">{p.verdict.reason}</span>
      </div>

      {p.day0 ? (
        <div className="day0">
          <img src={p.day0.url} alt={`${personLabel(p.person)}, day 0`} />
          <div className="small">
            <div className="day0-title">
              <b>Day 0</b>
              {p.day0.gate_passed === null ? <Badge tone="neutral">checking</Badge>
                : p.day0.gate_passed ? <Badge tone="pass">passed</Badge>
                : <Badge tone="fail">failed</Badge>}
            </div>
            {p.day0.gate_passed === false && (
              <p className="muted">
                {p.day0.failed.join(", ")}. <a href={href("results", { set: `trial-${p.person}` })} onClick={() => selectPerson(p.person)}>Retake</a> before the first use if you still can.
              </p>
            )}
          </div>
        </div>
      ) : (
        <p className="muted small">No day-0 photo yet. Take it before the first use.</p>
      )}
    </article>
  );
}
