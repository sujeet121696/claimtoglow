// Results: pick a set, analyse it with YouCam (raw_score only), and compare changes with the noise
// floor from the person's repeat photos. The set lives in the URL: /results?set=trial-sahni.
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRoute } from "../../app/router";
import { useStore } from "../../app/store";
import { api } from "../../api/client";
import type { NoiseRow, Photo, PhotoSet, SetSummary } from "../../api/types";
import { Card, PageHeader, Segmented } from "../../components/ui";
import { parseSetName, sideShort } from "../../domain/trial";
import { checkUnchecked } from "../../lib/gateBackfill";
import { AnalyseBar } from "./AnalyseBar";
import { PhotoStrip } from "./PhotoStrip";
import { ScoreTable } from "./ScoreTable";
import { FLOOR_SERIES, groupSets, setLabel, viewScores, type ScoreView } from "./scores";
import "./results.css";

const VIEWS: { value: ScoreView; label: string }[] = [
  { value: "whole", label: "Whole face" },
  { value: "T-C", label: "Treated − control" },
  { value: "L", label: "Left half" },
  { value: "R", label: "Right half" },
];

export function ResultsPage() {
  const { people, person, selectPerson, version, refresh } = useStore();
  const [route, go] = useRoute();
  const name = route.params.get("set") || (person ? `trial-${person.person}` : "");

  const [sets, setSets] = useState<SetSummary[]>([]);
  const [data, setData] = useState<PhotoSet | null>(null);
  const [floors, setFloors] = useState<NoiseRow[]>([]);
  const [floorSet, setFloorSet] = useState("");
  const [view, setView] = useState<ScoreView>("whole");
  const [delta, setDelta] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const stopRef = useRef(false);

  const setPerson = parseSetName(name)?.person;
  const side = people.find((p) => p.person === setPerson)?.treated_side ?? "L";

  // When the header's person changes, show that person's daily check-ins.
  const lastPerson = useRef(person?.person);
  useEffect(() => {
    if (person && person.person !== lastPerson.current) {
      lastPerson.current = person.person;
      go("results", { set: `trial-${person.person}` });
    }
  }, [person, go]);

  // A person's trial is judged against their own repeat photos: trial-sahni → noise-sahni.
  useEffect(() => {
    setFloorSet(setPerson ? `noise-${setPerson}` : "");
  }, [setPerson]);

  useEffect(() => {
    api.sets().then(setSets).catch(() => setSets([]));
  }, [version]);

  const load = useCallback(() => {
    if (!name) return;
    api.set(name).then(setData).catch(() => setData(null));
    checkUnchecked(name).then((n) => { if (n) api.set(name).then(setData); }).catch(() => {});
  }, [name]);
  useEffect(load, [load, version]);

  useEffect(() => {
    if (!floorSet) return setFloors([]);
    Promise.all([api.noise(floorSet, false), api.noise(floorSet, true)])
      .then(([a, b]) => setFloors([...a, ...b]))
      .catch(() => setFloors([]));
  }, [floorSet, data]);

  function chooseSet(next: string) {
    const p = parseSetName(next)?.person;
    if (p && people.some((x) => x.person === p)) {
      lastPerson.current = p;
      selectPerson(p);
    }
    go("results", { set: next });
  }

  async function analyse(mode: "whole" | "split") {
    const split = mode === "split";
    const todo = (data?.photos ?? []).filter((p) => (split ? !p.split : !p.scores));
    stopRef.current = false;
    for (const p of todo) {
      if (stopRef.current) break;
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

  async function retake(stem: string) {
    try {
      await api.retire(name, stem);
      load();
      refresh();
    } catch (e) {
      setErrors((errs) => ({ ...errs, [stem]: (e as Error).message }));
    }
  }

  const photos: Photo[] = data?.photos ?? [];
  const rows = photos.map((p) => ({ stem: p.stem, scores: viewScores(p, view, side) }));
  const floorOf = useMemo(() => {
    const m = new Map(floors.filter((f) => f.series === FLOOR_SERIES[view]).map((f) => [f.concern, f.floor]));
    return (c: string) => m.get(c);
  }, [floors, view]);
  const groups = groupSets(sets, people);
  const noiseOptions = sets.filter((s) => !s.name.startsWith("trial-"));
  const hasScores = rows.some((r) => r.scores);

  return (
    <>
      <PageHeader
        title="Results"
        description="Analyse photos with YouCam, then compare each change with the noise floor. Changes inside the floor are noise."
        actions={
          <select aria-label="Photo set" value={name} onChange={(e) => chooseSet(e.target.value)}>
            {!sets.some((s) => s.name === name) && <option value={name}>{setLabel(name, people)}</option>}
            {groups.map((g) => (
              <optgroup key={g.label} label={g.label}>
                {g.sets.map((s) => <option key={s.name} value={s.name}>{setLabel(s.name, people)} ({s.count})</option>)}
              </optgroup>
            ))}
          </select>
        }
      />

      <Card
        title={`Photos · ${photos.length}`}
        actions={data && (
          <AnalyseBar
            pending={{ whole: photos.filter((p) => !p.scores).length, split: photos.filter((p) => !p.split).length }}
            keyVar={data.key_var}
            busy={busy}
            onRun={analyse}
            onStop={() => (stopRef.current = true)}
          />
        )}
      >
        <PhotoStrip photos={photos} errors={errors} onRetake={retake} />
      </Card>

      <Card
        title="Scores"
        actions={
          <div className="score-controls">
            <Segmented options={VIEWS} value={view} onChange={setView} />
            <label className="option"><input type="checkbox" checked={delta} onChange={(e) => setDelta(e.target.checked)} /> Change since first photo</label>
            <select aria-label="Noise floor from" value={floorSet} onChange={(e) => setFloorSet(e.target.value)}>
              <option value="">No noise floor</option>
              {noiseOptions.map((s) => <option key={s.name} value={s.name}>Floor: {setLabel(s.name, people)}</option>)}
            </select>
          </div>
        }
      >
        {view === "T-C" && <p className="muted small">Treated side: {sideShort(side)}. Positive means the treated side scored higher than the control side.</p>}
        {hasScores ? <ScoreTable rows={rows} delta={delta} floorOf={floorOf} /> : (
          <p className="muted">No {view === "whole" ? "whole-face" : "split-face"} scores yet. Use “Analyse” above.</p>
        )}
        {floors.length > 0 && (
          <details className="noise">
            <summary>Noise details: {setLabel(floorSet, people)} (floor = 2√2 × SD)</summary>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Series</th><th>Concern</th><th>n</th><th>Mean</th><th>SD</th><th>Floor</th></tr></thead>
                <tbody>
                  {floors.map((f) => (
                    <tr key={f.series + f.concern}><th>{f.series}</th><td>{f.concern}</td><td>{f.n}</td><td>{f.mean}</td><td>{f.sd}</td><td>{f.floor}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </Card>
    </>
  );
}
