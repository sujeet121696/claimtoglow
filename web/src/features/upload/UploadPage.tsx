import { useStore } from "../../app/store";
import { setNameFor } from "../../domain/trial";
import { TrialHeader, useKind } from "../people/TrialHeader";
import { Uploader } from "./Uploader";
import "./upload.css";

export function UploadPage() {
  const { person, refresh } = useStore();
  const kind = useKind();
  if (!person) return null;
  const setName = setNameFor(kind, person.person);
  return (
    <>
      <TrialHeader page="upload" title="Upload" person={person} kind={kind} />
      <Uploader key={setName} setName={setName} side={person.treated_side} onSaved={refresh} />
    </>
  );
}
