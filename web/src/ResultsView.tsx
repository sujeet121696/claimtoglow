// Analyse a set with YouCam (raw_score only), see scores per photo, and compare changes against
// the noise floor measured on a repeat-photo set.
import { useCallback, useEffect, useMemo, useState } from "react";
import { api, type NoiseRow, type Photo, type PhotoSet, type Scores, type Side } from "./api";
import { CONCERNS } from "./shared";

type View = "whole" | "L" | "R" | "T-C";
const FLOOR_SERIES: Record<View, string> = { whole: "photo", L: "L", R: "R", "T-C": "L-R" };

function viewScores(p: Photo, view: View, side: Side): Scores | null {
  if (view === "whole") return p.scores;
  if (!p.split) return null;
  if (view !== "T-C") return p.split[view];
  const t = p.split[side];
  const c = p.split[side === "L" ? "R" : "L"];
  return Object.fromEntries(Object.keys(t).filter((k) => k in c).map((k) => [k, t[k] - c[k]]));
}

export function ResultsView({ side, refreshKey }: { side: Side; refreshKey: number }) {
  const [sets, setSets] = useState<{ name: string; count: number }[]>([]);
  const [name, setName] = useState("");
  const [data, setData] = useState<PhotoSet | null>(null);
  const [view, setView] = useState<View>("whole");
  const [delta, setDelta] = useState(false);
  const [floorSet, setFloorSet] = useState("noise-01");
  const [floors, setFloors] = useState<NoiseRow[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<"whole" | "split" | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [stopFlag, setStopFlag] = useState({ stop: false });

  useEffect(() => {
    api.sets().then((s) => {
      setSets(s);
      setName((n) => n || (s.find((x) => x.name === "trial" && x.count) ?? s.find((x) => x.count) ?? s[0])?.name || "");
    });
  }, [refreshKey]);

  const load = useCallback(() => {
    if (name) api.set(name).then(setData).catch(() => setData(null));
  }, [name]);
  useEffect(load, [load, refreshKey]);

  useEffect(() => {
    if (!floorSet) return setFloors([]);
    Promise.all([api.noise(floorSet, false), api.noise(floorSet, true)])
      .then(([a, b]) => setFloors([...a, ...b]))
      .catch(() => setFloors([]));
  }, [floorSet, data]);

  async function analyse(photos: Photo[], split: boolean) {
    setConfirm(null);
    const flag = { stop: false };
    setStopFlag(flag);
    for (const p of photos) {
      if (flag.stop) break;
      setBusy(`${split ? "Split-analysing" : "Analysing"} ${p.stem}…`);
      try {
        setData(await api.analyze(name, p.stem, split));
        setErrors((e) => ({ ...e, [p.stem]: "" }));
      } catch (e) {
        setErrors((errs) => ({ ...errs, [p.stem]: (e as Error).message }));
      }
    }
    setBusy(null);
  }

  const photos = data?.photos ?? [];
  const pendingWhole = photos.filter((p) => !p.scores);
  const pendingSplit = photos.filter((p) => !p.split);
  const rows = photos.map((p) => ({ p, s: viewScores(p, view, side) }));
  const base = rows.find((r) => r.s)?.s ?? null;
  const floorOf = useMemo(() => {
    const m = new Map(floors.filter((f) => f.series === FLOOR_SERIES[view]).map((f) => [f.concern, f.floor]));
    return (c: string) => m.get(c);
  }, [floors, view]);
  const concerns = useMemo(() => {
    const seen = new Set(rows.flatMap((r) => Object.keys(r.s ?? {})));
    return [...CONCERNS.filter((c) => seen.has(c)), ...[...seen].filter((c) => !CONCERNS.includes(c))];
  }, [rows]);

  return (
    <section className="results">
      <div className="row wrap">
        <label className="field">
          Set
          <select value={name} onChange={(e) => setName(e.target.value)}>
            {sets.map((s) => <option key={s.name} value={s.name}>{s.name} ({s.count})</option>)}
          </select>
        </label>
        {busy ? (
          <>
            <span className="status">{busy}</span>
            <button onClick={() => (stopFlag.stop = true)}>Stop after this one</button>
          </>
        ) : confirm ? (
          <span className="confirm">
            Run {confirm === "whole" ? pendingWhole.length : pendingSplit.length * 2} YouCam analyses? Each success costs units.
            <button className="primary" onClick={() => analyse(confirm === "whole" ? pendingWhole : pendingSplit, confirm === "split")}>Yes, run</button>
            <button onClick={() => setConfirm(null)}>Cancel</button>
          </span>
        ) : (
          <>
            <button disabled={!pendingWhole.length} onClick={() => setConfirm("whole")}>Analyse whole face ({pendingWhole.length} pending)</button>
            <button disabled={!pendingSplit.length} onClick={() => setConfirm("split")}>Analyse split-face ({pendingSplit.length} pending, ×2)</button>
          </>
        )}
      </div>

      <div className="photo-strip">
        {photos.map((p) => (
          <figure key={p.stem} className="photo-card">
            <img src={p.url} alt={p.stem} loading="lazy" />
            <figcaption>
              <b>{p.stem}</b>
              <span className="mono small" title={p.sha256}>{p.sha256.slice(0, 10)}</span>
              <span className="small">
                gate {p.meta.gate ? (p.meta.gate.passed ? "✓" : "✗") : "–"} · whole {p.scores ? "✓" : "–"} · split {p.split ? "✓" : "–"}
              </span>
              {errors[p.stem] && <span className="error small">{errors[p.stem]}</span>}
            </figcaption>
          </figure>
        ))}
        {!photos.length && <p className="muted">No photos in this set yet.</p>}
      </div>

      <div className="row wrap">
        <div className="segmented">
          {(["whole", "L", "R", "T-C"] as View[]).map((v) => (
            <button key={v} className={view === v ? "on" : ""} onClick={() => setView(v)}>
              {v === "whole" ? "Whole face" : v === "T-C" ? "Treated − control" : `Half ${v}`}
            </button>
          ))}
        </div>
        <label><input type="checkbox" checked={delta} onChange={(e) => setDelta(e.target.checked)} /> Change vs first photo</label>
        <label className="field">
          Noise floor from
          <select value={floorSet} onChange={(e) => setFloorSet(e.target.value)}>
            <option value="">none</option>
            {sets.map((s) => <option key={s.name} value={s.name}>{s.name}</option>)}
          </select>
        </label>
      </div>
      {view === "T-C" && <p className="muted small">Treated side: image {side === "L" ? "left" : "right"}. raw_score per concern; higher looks better, to be confirmed.</p>}

      {concerns.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Photo</th>
                {concerns.map((c) => <th key={c}>{c.replace("_v2", "").replace("_", " ")}</th>)}
              </tr>
            </thead>
            <tbody>
              {rows.map(({ p, s }) => (
                <tr key={p.stem}>
                  <th>{p.stem}</th>
                  {concerns.map((c) => {
                    const v = s?.[c];
                    if (v === undefined) return <td key={c} className="muted">–</td>;
                    const d = base && base[c] !== undefined ? v - base[c] : null;
                    const floor = floorOf(c);
                    const beyond = delta && d !== null && floor !== undefined && Math.abs(d) > floor;
                    return (
                      <td key={c} className={beyond ? (d! > 0 ? "beyond up" : "beyond down") : ""}>
                        {delta ? (d === null ? "–" : `${d > 0 ? "+" : ""}${d.toFixed(1)}`) : v.toFixed(1)}
                      </td>
                    );
                  })}
                </tr>
              ))}
              {floors.some((f) => f.series === FLOOR_SERIES[view]) && (
                <tr className="floor-row">
                  <th>floor ±</th>
                  {concerns.map((c) => <td key={c}>{floorOf(c)?.toFixed(1) ?? "–"}</td>)}
                </tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="muted">No {view === "whole" ? "whole-face" : "split-face"} results yet for this set.</p>
      )}

      {floors.length > 0 && (
        <details className="noise">
          <summary>Noise in {floorSet} (n, SD, floor = 2√2 × SD)</summary>
          <table>
            <thead><tr><th>series</th><th>concern</th><th>n</th><th>mean</th><th>SD</th><th>floor</th></tr></thead>
            <tbody>
              {floors.map((f) => (
                <tr key={f.series + f.concern}><td>{f.series}</td><td>{f.concern}</td><td>{f.n}</td><td>{f.mean}</td><td>{f.sd}</td><td>{f.floor}</td></tr>
              ))}
            </tbody>
          </table>
        </details>
      )}
    </section>
  );
}
