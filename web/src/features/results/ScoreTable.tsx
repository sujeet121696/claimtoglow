import type { Scores } from "../../api/types";
import { CHANGE, changeResult, concernLabel, CONCERNS } from "../../domain/trial";

type Row = { stem: string; scores: Scores | null };

/**
 * Scores per photo (raw_score, higher is better for every concern), or the change since the first
 * photo, coloured only when it is bigger than the noise floor; anything inside the floor is noise.
 */
export function ScoreTable({ rows, delta, floorOf }: { rows: Row[]; delta: boolean; floorOf: (concern: string) => number | undefined }) {
  const seen = new Set(rows.flatMap((r) => Object.keys(r.scores ?? {})));
  const concerns = [...CONCERNS.filter((c) => seen.has(c)), ...[...seen].filter((c) => !CONCERNS.includes(c))];
  if (!concerns.length) return null;
  const base = rows.find((r) => r.scores)?.scores ?? null;
  const hasFloor = concerns.some((c) => floorOf(c) !== undefined);

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th scope="col">Photo</th>
            {concerns.map((c) => (
              <th key={c} scope="col">
                {concernLabel(c)} <span className="dir" aria-label="higher is better">↑</span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ stem, scores }) => (
            <tr key={stem}>
              <th scope="row">{stem}</th>
              {concerns.map((c) => {
                const v = scores?.[c];
                if (v === undefined) return <td key={c} className="muted">–</td>;
                if (!delta) return <td key={c}>{v.toFixed(1)}</td>;
                const d = base?.[c] !== undefined ? v - base[c] : null;
                const change = CHANGE[changeResult(d, floorOf(c))];
                return (
                  <td key={c} className={`change ${change.tone}`} title={change.label}>
                    {d === null ? "–" : <>{change.tone === "better" || change.tone === "worse" ? `${change.icon} ` : ""}{d > 0 ? "+" : ""}{d.toFixed(1)}</>}
                  </td>
                );
              })}
            </tr>
          ))}
          {hasFloor && (
            <tr className="floor-row">
              <th scope="row">noise floor ±</th>
              {concerns.map((c) => <td key={c}>{floorOf(c)?.toFixed(1) ?? "–"}</td>)}
            </tr>
          )}
        </tbody>
      </table>
      {delta && (
        <p className="muted small legend">
          <span className="change better">▲ better</span> or <span className="change worse">▼ worse</span> beyond the noise floor; plain = within the noise (no clear change).
        </p>
      )}
    </div>
  );
}
