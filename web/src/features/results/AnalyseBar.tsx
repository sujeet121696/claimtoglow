import { personLabel } from "../../domain/trial";

type Mode = "whole" | "split";

/** Whose units pay: YOUCAM_API_SAHNI_KEY → "Sahni's key"; YOUCAM_API_KEY → "the main key". */
const payer = (keyVar: string) => {
  const m = keyVar.match(/^YOUCAM_API_(.+)_KEY$/);
  return m ? `${personLabel(m[1].toLowerCase())}'s key` : "the main key";
};

/** Runs YouCam analyses on pending photos with one click. Hovering a button shows whose key pays;
 *  a run can be stopped after the current photo. */
export function AnalyseBar({ pending, keyVar, busy, onRun, onStop }: {
  pending: Record<Mode, number>;
  keyVar: string;
  busy: string | null;
  onRun: (mode: Mode) => void;
  onStop: () => void;
}) {
  if (busy) {
    return (
      <div className="analyse-bar">
        <span className="status" role="status">{busy}</span>
        <button onClick={onStop}>Stop after this one</button>
      </div>
    );
  }
  return (
    <div className="analyse-bar">
      <button disabled={!pending.whole} onClick={() => onRun("whole")} title={`Paid from ${payer(keyVar)}`}>
        Analyse whole face ({pending.whole})
      </button>
      <button disabled={!pending.split} onClick={() => onRun("split")} title={`Each photo is analysed as two mirrored halves. Paid from ${payer(keyVar)}`}>
        Analyse split-face ({pending.split} × 2)
      </button>
    </div>
  );
}
