// Add or edit a person's trial: product, claim, treated side, day 0 and length (trial.json).
import { useState } from "react";
import { useStore } from "../../app/store";
import { api } from "../../api/client";
import type { Side, TrialFields } from "../../api/types";
import { Field } from "../../components/ui";
import { personLabel, sideLabel } from "../../domain/trial";
import "./people.css";

export function PersonEditor() {
  const { editing, edit, selectPerson, refresh } = useStore();
  const person = editing === "new" ? null : editing;
  const [id, setId] = useState(person?.person ?? "");
  const [fields, setFields] = useState<TrialFields>({
    product: person?.product ?? "",
    claim: person?.claim ?? "",
    treated_side: person?.treated_side ?? "L",
    start_date: person?.start_date ?? new Date().toISOString().slice(0, 10),
    duration_days: person?.duration_days ?? 21,
  });
  const [error, setError] = useState("");
  const set = <K extends keyof TrialFields>(k: K, v: TrialFields[K]) => setFields((f) => ({ ...f, [k]: v }));

  if (!editing) return null;

  async function save() {
    try {
      const saved = await api.savePerson(id.trim().toLowerCase(), fields);
      edit(null);
      selectPerson(saved.person);
      refresh();
    } catch (e) {
      setError((e as Error).message);
    }
  }

  return (
    <div className="dialog-backdrop" onClick={() => edit(null)}>
      <div className="dialog card" role="dialog" aria-modal="true" aria-labelledby="editor-title" onClick={(e) => e.stopPropagation()}>
        <h2 id="editor-title">{person ? `Edit ${personLabel(person.person)}` : "Add a person"}</h2>
        <div className="form-grid">
          <Field label="Name" hint={!person && `Lowercase. Their own API key goes in .env as YOUCAM_API_KEY_${(id || "NAME").toUpperCase()}`}>
            <input value={id} onChange={(e) => setId(e.target.value)} disabled={!!person} placeholder="e.g. sahni" autoFocus={!person} />
          </Field>
          <Field label="Product">
            <input value={fields.product} onChange={(e) => set("product", e.target.value)} placeholder="Product name" />
          </Field>
          <Field label="Claim, as the brand words it">
            <textarea rows={3} value={fields.claim} onChange={(e) => set("claim", e.target.value)} />
          </Field>
          <Field label="Treated side">
            <select value={fields.treated_side} onChange={(e) => set("treated_side", e.target.value as Side)}>
              <option value="L">{sideLabel("L")}</option>
              <option value="R">{sideLabel("R")}</option>
            </select>
          </Field>
          <div className="form-row">
            <Field label="Day 0">
              <input type="date" value={fields.start_date ?? ""} onChange={(e) => set("start_date", e.target.value || null)} />
            </Field>
            <Field label="Length (days)">
              <input type="number" min={1} max={90} value={fields.duration_days} onChange={(e) => set("duration_days", Number(e.target.value))} />
            </Field>
          </div>
        </div>
        {error && <p className="error">{error}</p>}
        <div className="dialog-actions">
          <button onClick={() => edit(null)}>Cancel</button>
          <button className="primary" disabled={!id.trim()} onClick={save}>Save</button>
        </div>
      </div>
    </div>
  );
}
