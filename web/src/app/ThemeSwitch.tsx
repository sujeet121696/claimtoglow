// System / Light / Dark switch: in the account menu, and in the demo's footer (no account there).
import { useState } from "react";
import { LineIcon } from "../components/icons";
import { loadTheme, setTheme, type Theme } from "../lib/theme";

const OPTIONS: { value: Theme; label: string; d: string; filled?: string }[] = [
  { value: "system", label: "Auto", d: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z", filled: "M12 3a9 9 0 0 0 0 18z" },
  { value: "light", label: "Light", d: "M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" },
  { value: "dark", label: "Dark", d: "M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5z" },
];

/** `labels` adds the words beside the icons (the account menu); the demo footer shows icons only. */
export function ThemeSwitch({ labels = false }: { labels?: boolean }) {
  const [theme, setChoice] = useState(loadTheme);
  const choose = (t: Theme) => { setTheme(t); setChoice(t); };
  return (
    <div className={labels ? "segmented theme-switch labelled" : "segmented theme-switch"} role="group" aria-label="Colour theme">
      {OPTIONS.map((o) => (
        <button key={o.value} type="button" aria-pressed={theme === o.value} aria-label={labels ? undefined : o.label} title={o.value === "system" ? "Match this device" : o.label} onClick={() => choose(o.value)}>
          <LineIcon d={o.d} filled={o.filled} />
          {labels && o.label}
        </button>
      ))}
    </div>
  );
}
