import type { Check } from "../lib/gate";

/** The capture gate's checks: ✓/✗, the measured value, and a hint for each failure. */
export function ChecksList({ checks, empty = "Waiting for a face…" }: { checks: Check[]; empty?: string }) {
  if (!checks.length) return <p className="muted">{empty}</p>;
  return (
    <ul className="checks">
      {checks.map((c) => (
        <li key={c.id} className={c.pass ? "pass" : c.optional ? "warn" : "fail"}>
          <span className="mark" aria-hidden>{c.pass ? "✓" : c.optional ? "!" : "✗"}</span>
          <span className="label">{c.label}</span>
          <span className="value">{c.value}</span>
          {!c.pass && <span className="hint">{c.hint}</span>}
        </li>
      ))}
    </ul>
  );
}
