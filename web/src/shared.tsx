import { useCallback, useEffect, useState } from "react";
import { api, type Side } from "./api";
import { referenceFrom, type Check, type Reference } from "./gate";

export const CONCERNS = [
  "acne", "age_spot", "redness", "radiance", "texture",
  "pore", "wrinkle", "moisture", "oiliness", "dark_circle_v2",
];

export const SET_RE = /^[a-z0-9][a-z0-9._-]{0,60}$/i;

export type RefState = { ref: Reference | null; img: HTMLImageElement | null; url: string | null };

/** The day-0 trial photo (trial/day-00): its metrics for matching and its image for the ghost overlay. */
export function useReference(): [RefState, () => void] {
  const [state, setState] = useState<RefState>({ ref: null, img: null, url: null });
  const load = useCallback(() => {
    api.reference().then((r) => {
      if (!r) return setState({ ref: null, img: null, url: null });
      const img = new Image();
      img.onload = () => setState({ ref: referenceFrom(r.meta), img, url: r.url });
      img.src = r.url;
    }).catch(() => setState({ ref: null, img: null, url: null }));
  }, []);
  useEffect(load, [load]);
  return [state, load];
}

export function SetPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [sets, setSets] = useState<string[]>([]);
  useEffect(() => {
    api.sets().then((s) => setSets(s.map((x) => x.name))).catch(() => {});
  }, []);
  const options = Array.from(new Set(["trial", "noise-01", ...sets]));
  return (
    <label className="field">
      Save to
      <input
        list="set-names"
        value={value}
        onChange={(e) => onChange(e.target.value.trim())}
        className={SET_RE.test(value) ? "" : "invalid"}
        size={12}
      />
      <datalist id="set-names">
        {options.map((s) => <option key={s} value={s} />)}
      </datalist>
    </label>
  );
}

export function ChecksList({ checks }: { checks: Check[] }) {
  if (!checks.length) return <p className="muted">Waiting for a face…</p>;
  return (
    <ul className="checks">
      {checks.map((c) => (
        <li key={c.id} className={c.pass ? "pass" : "fail"}>
          <span className="mark">{c.pass ? "✓" : "✗"}</span>
          <span className="label">{c.label}</span>
          <span className="value">{c.value}</span>
          {!c.pass && <span className="hint">{c.hint}</span>}
        </li>
      ))}
    </ul>
  );
}

export const sideLabel = (s: Side) => (s === "L" ? "image left (your right cheek)" : "image right (your left cheek)");

let audio: AudioContext | null = null;
export function beep(freq = 660, seconds = 0.12) {
  try {
    audio ??= new AudioContext();
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.frequency.value = freq;
    gain.gain.value = 0.15;
    osc.connect(gain).connect(audio.destination);
    osc.start();
    osc.stop(audio.currentTime + seconds);
  } catch {
    /* no audio, no beep */
  }
}
