// One claimed concern over the trial: each analysed check-in's change since baseline (treated −
// control), the noise band a single photo can't escape, and the checkpoint result the verdict used.
import { useLayoutEffect, useRef, useState } from "react";
import type { TimelineEntry, VerdictRow } from "../../api/types";

// The chart is drawn at its real width (one unit = one pixel), so text stays the same size on a
// phone and on a laptop instead of shrinking with the screen.
const H = 200, PAD = { l: 44, r: 28, t: 12, b: 28 };

function useWidth(fallback: number) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(fallback);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setWidth(Math.max(280, Math.min(1200, Math.round(el.clientWidth))));
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return [ref, width] as const;
}

export function TrendChart({ concern, entries, baseline, sd, k0, duration, row, checkpointDay }: {
  concern: string;
  entries: TimelineEntry[];
  baseline: number | null;
  sd: number | null;
  k0: number;
  duration: number;
  row: VerdictRow | undefined;
  checkpointDay: number | null;
}) {
  const [ref, W] = useWidth(640);
  const points = entries
    .filter((e) => e.day !== null && e.tc?.[concern] !== undefined && baseline !== null)
    .map((e) => ({ day: e.day!, change: e.tc![concern] - baseline!, checkpoint: e.checkpoint, stem: e.stem }));
  // Noise for one photo against the baseline mean: 2·SD·√(1 + 1/k0) (verdict.py with k = 1).
  const band = sd !== null && k0 ? 2 * sd * Math.sqrt(1 + 1 / k0) : null;
  const effect = row?.effect ?? null;
  const span = Math.max(1, band ?? 0, effect !== null ? Math.abs(effect) : 0, ...points.map((p) => Math.abs(p.change))) * 1.2;

  const x = (day: number) => PAD.l + (day / Math.max(1, duration)) * (W - PAD.l - PAD.r);
  const y = (v: number) => PAD.t + ((span - v) / (2 * span)) * (H - PAD.t - PAD.b);
  const checkpoints = Array.from({ length: Math.floor(duration / 7) }, (_, i) => (i + 1) * 7);
  if (!checkpoints.includes(duration)) checkpoints.push(duration);
  const fmt = (v: number) => `${v > 0 ? "+" : ""}${v.toFixed(1)}`;

  return (
    <div ref={ref} className="trend-wrap">
      <svg className="trend" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img"
        aria-label={`${concern}: change since baseline for ${points.length} analysed check-ins`}>
        {band !== null && <rect className="band" x={PAD.l} width={W - PAD.l - PAD.r} y={y(band)} height={y(-band) - y(band)} />}
        <line className="zero" x1={PAD.l} x2={W - PAD.r} y1={y(0)} y2={y(0)} />
        {[span / 1.2, -span / 1.2].map((v) => (
          <text key={v} className="tick" x={PAD.l - 6} y={y(v) + 4} textAnchor="end">{fmt(v)}</text>
        ))}
        {[0, ...checkpoints].map((d) => (
          <g key={d}>
            {d > 0 && <line className="checkpoint-line" x1={x(d)} x2={x(d)} y1={PAD.t} y2={H - PAD.b} />}
            <text className="tick" x={x(d)} y={H - 8} textAnchor="middle">{d === 0 ? "day 0" : `day ${d}`}</text>
          </g>
        ))}
        {points.map((p) => (
          <circle key={p.stem} className={p.checkpoint ? "dot checkpoint" : "dot"} cx={x(p.day)} cy={y(p.change)} r={p.checkpoint ? 5 : 4}>
            <title>{`${p.stem}: ${fmt(p.change)}`}</title>
          </circle>
        ))}
        {effect !== null && checkpointDay !== null && row?.floor !== undefined && (
          <g className={`result ${row.result === "improved" ? "better" : row.result === "worsened" ? "worse" : "steady"}`}>
            <line x1={x(checkpointDay)} x2={x(checkpointDay)} y1={y(effect + row.floor)} y2={y(effect - row.floor)} />
            <rect x={x(checkpointDay) - 7} y={y(effect) - 7} width={14} height={14} transform={`rotate(45 ${x(checkpointDay)} ${y(effect)})`}>
              <title>{`Checkpoint day ${checkpointDay}: ${fmt(effect)} ± ${row.floor.toFixed(1)}`}</title>
            </rect>
          </g>
        )}
      </svg>
    </div>
  );
}
