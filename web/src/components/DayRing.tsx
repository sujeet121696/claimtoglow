// Trial progress as a ring: the day in the middle, a tick at each checkpoint (day 7, 14, … and the
// last day). The arc fills in on load (styles/components.css). Used on Today and the receipt.
const R = 22, C = 2 * Math.PI * R;

export function DayRing({ day, duration }: { day: number | null; duration: number }) {
  const span = Math.max(1, duration);
  const progress = day === null ? 0 : Math.min(1, Math.max(0, day / span));
  const checkpoints = [...Array.from({ length: Math.floor(duration / 7) }, (_, i) => (i + 1) * 7), duration]
    .filter((d, i, all) => all.indexOf(d) === i);
  const label = day === null || day < 0 ? "–" : String(Math.min(day, duration));

  return (
    <svg className="day-ring" viewBox="0 0 56 56" width="56" height="56" role="progressbar"
      aria-valuemin={0} aria-valuemax={duration} aria-valuenow={day === null ? 0 : Math.max(0, Math.min(day, duration))}
      aria-label={`Day ${label} of ${duration}`}>
      <circle className="ring-track" cx="28" cy="28" r={R} />
      <circle className="ring-fill" cx="28" cy="28" r={R} strokeDasharray={C}
        style={{ ["--ring-offset" as string]: C * (1 - progress), ["--ring-length" as string]: C }} />
      {checkpoints.map((d) => {
        const a = (d / span) * 2 * Math.PI - Math.PI / 2;
        const reached = day !== null && day >= d;
        return <circle key={d} className={reached ? "ring-tick reached" : "ring-tick"} cx={28 + R * Math.cos(a)} cy={28 + R * Math.sin(a)} r="2.6" />;
      })}
      <text x="28" y="27" textAnchor="middle" className="ring-day">{label}</text>
      <text x="28" y="38" textAnchor="middle" className="ring-of">of {duration}</text>
    </svg>
  );
}

/** "Checkpoint today", "Next checkpoint: day 7, in 5 days", or nothing outside the trial. */
export function nextCheckpoint(day: number | null, duration: number): string | null {
  if (day === null || day < 0 || day > duration) return null;
  const next = Math.min(Math.ceil(Math.max(day, 1) / 7) * 7, duration);
  if (next === day) return "Checkpoint today: 3 photos";
  const n = next - day;
  return `Next checkpoint: day ${next}, in ${n} ${n === 1 ? "day" : "days"}`;
}
