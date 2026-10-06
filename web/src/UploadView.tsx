// Runs the same gate on photos taken with the phone's own camera app, then saves them to a set.
import { useRef, useState } from "react";
import { api, type Side } from "./api";
import { gateImage, type GateRecord } from "./gate";
import { getLandmarker } from "./landmarker";
import { ChecksList, SET_RE, SetPicker, type RefState } from "./shared";

type Item = { id: number; file: File; url: string; stem: string; gate?: GateRecord; error?: string; saved?: string };

type Props = { side: Side; reference: RefState; onSaved: () => void };

export function UploadView({ side, reference, onSaved }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [setName, setSetName] = useState("trial");
  const canvas = useRef(document.createElement("canvas"));
  const nextId = useRef(0);

  const patch = (id: number, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));

  async function addFiles(files: FileList | null) {
    if (!files?.length) return;
    const added = Array.from(files).map((file) => ({ id: nextId.current++, file, url: URL.createObjectURL(file), stem: "" }));
    setItems((xs) => [...xs, ...added]);
    const landmarker = await getLandmarker("IMAGE");
    for (const item of added) {
      try {
        const bitmap = await createImageBitmap(item.file, { imageOrientation: "from-image" });
        patch(item.id, { gate: gateImage(landmarker, bitmap, reference.ref, canvas.current) });
        bitmap.close();
      } catch (e) {
        patch(item.id, { error: (e as Error).message });
      }
    }
  }

  async function save(item: Item) {
    if (!SET_RE.test(setName)) return patch(item.id, { error: "Pick a valid set name first" });
    try {
      const photo = await api.upload(setName, item.file, item.file.name, {
        source: "upload", treated_side: side, gate: item.gate, original_modified: new Date(item.file.lastModified).toISOString(),
      }, item.stem.trim());
      patch(item.id, { saved: `${setName}/${photo.stem}`, error: undefined });
      onSaved();
    } catch (e) {
      patch(item.id, { error: (e as Error).message });
    }
  }

  const passing = items.filter((i) => i.gate?.passed && !i.saved);

  return (
    <section className="upload">
      <div className="row wrap">
        <label className="primary file-button">
          Choose photos
          <input type="file" accept="image/jpeg,image/png" multiple onChange={(e) => addFiles(e.target.files)} hidden />
        </label>
        <SetPicker value={setName} onChange={setSetName} />
        <button disabled={!passing.length} onClick={() => passing.forEach(save)}>Save all passing ({passing.length})</button>
      </div>
      <p className="muted small">
        Use the original files (not WhatsApp-compressed). Rear camera is safest: some phones save front-camera
        selfies mirrored, which swaps the treated and control sides. Leave the name empty for the next free one
        ({setName === "trial" ? "day-NN" : "shot-NN"}).
      </p>

      <div className="upload-list">
        {items.map((item) => (
          <article key={item.id} className="upload-item">
            <img src={item.url} alt={item.file.name} />
            <div>
              <div className="row wrap">
                <b>{item.file.name}</b>
                {item.gate && <span className={`badge ${item.gate.passed ? "pass" : "fail"}`}>{item.gate.passed ? "Gate passed" : "Gate failed"}</span>}
              </div>
              {item.gate ? <ChecksList checks={item.gate.checks} /> : !item.error && <p className="muted">Checking…</p>}
              {item.saved ? (
                <p className="status">Saved as {item.saved}</p>
              ) : (
                <div className="row wrap">
                  <input placeholder="name (auto)" value={item.stem} onChange={(e) => patch(item.id, { stem: e.target.value })} size={10} />
                  <button className={item.gate?.passed ? "primary" : "ghost"} disabled={!item.gate} onClick={() => save(item)}>
                    {item.gate?.passed ? "Save" : "Save anyway"}
                  </button>
                </div>
              )}
              {item.error && <p className="error">{item.error}</p>}
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
