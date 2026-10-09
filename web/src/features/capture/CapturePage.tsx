import { useStore } from "../../app/store";
import { KINDS, personLabel, setNameFor } from "../../domain/trial";
import { TrialHeader, useKind } from "../people/TrialHeader";
import { Camera } from "./Camera";
import "./capture.css";

export function CapturePage() {
  const { person, refresh } = useStore();
  const kind = useKind();
  if (!person) return null;
  const setName = setNameFor(kind, person.person);
  return (
    <>
      <TrialHeader page="capture" title="Capture" person={person} kind={kind} />
      <Camera key={setName} setName={setName} side={person.treated_side} title={`${personLabel(person.person)} · ${KINDS[kind].label}`}
        stepOut={kind === "noise" || person.today_target > 1} done={kind === "trial" && person.today_done} onSaved={refresh} />
    </>
  );
}
