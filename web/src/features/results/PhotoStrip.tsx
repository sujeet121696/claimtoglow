import { useState } from "react";
import type { Photo } from "../../api/types";
import { Badge } from "../../components/ui";

/** Thumbnails with fingerprint, gate result, analysis status and a Retake action. */
export function PhotoStrip({ photos, errors, onRetake }: {
  photos: Photo[];
  errors: Record<string, string>;
  onRetake: (stem: string) => void;
}) {
  const [confirming, setConfirming] = useState<string | null>(null);
  if (!photos.length) return <p className="muted">No photos in this set yet.</p>;

  return (
    <div className="photo-strip">
      {photos.map((p) => {
        const gate = p.meta.gate;
        const failed = gate?.checks.filter((c) => !c.pass).map((c) => c.label) ?? [];
        // The image shown here is the one this device may load; the download is named <set>-<file>.
        const src = p.masked_url ?? p.url;
        const fileName = `${p.url.split("/")[3]}-${src.split("/").pop()}`;
        return (
          <figure key={p.stem} className="photo-card">
            <a href={src} target="_blank" rel="noopener" title="View full size">
              <img src={src} alt={p.stem} loading="lazy" />
            </a>
            <figcaption>
              <div className="photo-title">
                <b>{p.stem}</b>
                {gate ? <Badge tone={gate.passed ? "pass" : "fail"}>{gate.passed ? "passed" : "failed"}</Badge> : <Badge tone="neutral">checking</Badge>}
              </div>
              <span className="mono small muted" title={`SHA-256 ${p.sha256}`}>{p.sha256.slice(0, 10)}</span>
              {p.tampered && <span title="This file no longer matches the fingerprint saved when it was taken. Retake it."><Badge tone="fail">file changed</Badge></span>}
              <span className="small muted">whole {p.scores ? "✓" : "–"} · split {p.split ? "✓" : "–"}</span>
              {failed.length > 0 && <span className="small fail">{failed.join(", ")}</span>}
              <span className="photo-links small">
                <a href={src} target="_blank" rel="noopener">View</a>
                <a href={src} download={fileName}>Download</a>
              </span>
              {confirming === p.stem ? (
                <span className="photo-confirm">
                  <button className="primary small" onClick={() => { setConfirming(null); onRetake(p.stem); }}>Move aside</button>
                  <button className="small" onClick={() => setConfirming(null)}>Keep</button>
                </span>
              ) : (
                <button className="ghost small" title="Moves this photo and its analyses to photos/_retired so it can be taken again. Nothing is deleted." onClick={() => setConfirming(p.stem)}>
                  Retake…
                </button>
              )}
              {errors[p.stem] && <span className="error small">{errors[p.stem]}</span>}
            </figcaption>
          </figure>
        );
      })}
    </div>
  );
}
