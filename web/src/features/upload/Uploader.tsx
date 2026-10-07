// Runs the capture gate on photos taken with the phone's own camera app, then saves them to a set.
// Self-contained: give it a set name and the treated side.
import { useEffect, useRef, useState } from "react";
import { api } from "../../api/client";
import type { Side } from "../../api/types";
import { ChecksList } from "../../components/ChecksList";
import { Badge, Card } from "../../components/ui";
import { useReference } from "../../hooks/useReference";
import { gateImage, referenceFrom, type GateRecord } from "../../lib/gate";
import { getLandmarker } from "../../lib/landmarker";

type Item = { id: number; file: File; url: string; stem: string; gate?: GateRecord; error?: string; saved?: string };

type Props = { setName: string; side: Side; onSaved: () => void };

export function Uploader({ setName, side, onSaved }: Props) {
  const [items, setItems] = useState<Item[]>([]);
  const [dragging, setDragging] = useState(false);
  const [reference, reloadReference] = useReference(setName);
  const canvas = useRef(document.createElement("canvas"));
  const nextId = useRef(0);
  const urls = useRef<string[]>([]);

  useEffect(() => () => urls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  const patch = (id: number, p: Partial<Item>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...p } : x)));

  async function addFiles(files: FileList | null) {
    const images = Array.from(files ?? []).filter((f) => /^image\/(jpeg|png)$/.test(f.type));
    if (!images.length) return;
    const added = images.map((file) => {
      const url = URL.createObjectURL(file);
      urls.current.push(url);
      return { id: nextId.current++, file, url, stem: "" };
    });
    setItems((xs) => [...added, ...xs]);
    const landmarker = await getLandmarker("IMAGE");
    const ref = referenceFrom((await api.reference(setName).catch(() => null))?.meta ?? null);
    for (const item of added) {
      try {
        const bitmap = await createImageBitmap(item.file, { imageOrientation: "from-image" });
        patch(item.id, { gate: gateImage(landmarker, bitmap, ref, canvas.current) });
        bitmap.close();
      } catch (e) {
        patch(item.id, { error: (e as Error).message });
      }
    }
  }

  async function save(item: Item) {
    try {
      const photo = await api.upload(setName, item.file, item.file.name, {
        source: "upload", treated_side: side, gate: item.gate, original_modified: new Date(item.file.lastModified).toISOString(),
      }, item.stem.trim());
      patch(item.id, { saved: photo.stem, error: undefined });
      if (photo.stem === "day-00") reloadReference();
      onSaved();
    } catch (e) {
      patch(item.id, { error: (e as Error).message });
    }
  }

  const passing = items.filter((i) => i.gate?.passed && !i.saved);

  return (
    <div className="uploader">
      <label
        className={`dropzone ${dragging ? "dragging" : ""}`}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => { e.preventDefault(); setDragging(false); addFiles(e.dataTransfer.files); }}
      >
        <input type="file" accept="image/jpeg,image/png" multiple onChange={(e) => addFiles(e.target.files)} hidden />
        <strong>Drop photos here or click to choose</strong>
        <span className="muted small">
          Original files from the same camera as day 0 (not WhatsApp-compressed). Checked against day 0{reference.ref ? "" : " once it exists"}.
        </span>
      </label>

      {items.length > 0 && (
        <div className="uploader-bar">
          <span className="muted small">{items.length} photo{items.length > 1 ? "s" : ""} · {passing.length} ready to save</span>
          <button className="primary" disabled={!passing.length} onClick={() => passing.forEach(save)}>Save all passing</button>
        </div>
      )}

      <div className="upload-list">
        {items.map((item) => (
          <Card key={item.id} className="upload-item">
            <img src={item.url} alt={item.file.name} />
            <div className="upload-body">
              <div className="upload-title">
                <b>{item.file.name}</b>
                {item.saved ? <Badge tone="pass">saved as {item.saved}</Badge>
                  : item.gate ? <Badge tone={item.gate.passed ? "pass" : "fail"}>{item.gate.passed ? "passed" : "failed"}</Badge>
                  : !item.error && <Badge tone="neutral">checking</Badge>}
              </div>
              {item.gate && <ChecksList checks={item.gate.checks} />}
              {!item.saved && item.gate && (
                <div className="upload-actions">
                  <input
                    aria-label="Photo name"
                    placeholder={setName.startsWith("trial") ? "name: today's day" : "name: next shot"}
                    title="Leave empty for the automatic name. Type one (e.g. day-03) only to add a missed day."
                    value={item.stem}
                    onChange={(e) => patch(item.id, { stem: e.target.value })}
                  />
                  <button className={item.gate.passed ? "primary" : "ghost"} onClick={() => save(item)}>
                    {item.gate.passed ? "Save" : "Save anyway"}
                  </button>
                </div>
              )}
              {item.error && <p className="error">{item.error}</p>}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
