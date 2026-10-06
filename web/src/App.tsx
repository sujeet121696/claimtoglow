import { useState } from "react";
import type { Side } from "./api";
import { CameraView } from "./CameraView";
import { ResultsView } from "./ResultsView";
import { sideLabel, useReference } from "./shared";
import { UploadView } from "./UploadView";

type Tab = "capture" | "upload" | "results";
const TABS: Record<Tab, string> = { capture: "Capture", upload: "Upload", results: "Results" };

function load<T extends string>(key: string, fallback: T): T {
  try {
    return (localStorage.getItem(key) as T) || fallback;
  } catch {
    return fallback;
  }
}

function save(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* private mode: setting just won't stick */
  }
}

export function App() {
  const [tab, setTab] = useState<Tab>(() => load("tab", "capture"));
  const [side, setSide] = useState<Side>(() => load("treatedSide", "L"));
  const [reference, reloadReference] = useReference();
  const [refreshKey, setRefreshKey] = useState(0);

  const onSaved = () => {
    reloadReference();
    setRefreshKey((k) => k + 1);
  };

  return (
    <div className="app">
      <header>
        <h1>Claim to Glow <span className="muted">lab</span></h1>
        <nav>
          {(Object.keys(TABS) as Tab[]).map((t) => (
            <button key={t} className={tab === t ? "on" : ""} onClick={() => { setTab(t); save("tab", t); }}>
              {TABS[t]}
            </button>
          ))}
        </nav>
        <label className="field side">
          Treated side
          <select value={side} onChange={(e) => { setSide(e.target.value as Side); save("treatedSide", e.target.value); }}>
            {(["L", "R"] as Side[]).map((s) => <option key={s} value={s}>{sideLabel(s)}</option>)}
          </select>
        </label>
      </header>
      <main>
        {tab === "capture" && <CameraView side={side} reference={reference} onSaved={onSaved} />}
        {tab === "upload" && <UploadView side={side} reference={reference} onSaved={onSaved} />}
        {tab === "results" && <ResultsView side={side} refreshKey={refreshKey} />}
      </main>
      <footer className="muted small">Cosmetic skin metrics only, not a diagnosis. Photos stay on this machine.</footer>
    </div>
  );
}
