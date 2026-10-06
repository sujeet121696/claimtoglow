// Client for the local FastAPI server (app/main.py), proxied by Vite.
import type { GateRecord } from "./gate";

export type Scores = Record<string, number>;

export type PhotoMeta = {
  sha256?: string;
  saved_at?: string;
  source?: "camera" | "upload";
  treated_side?: Side;
  gate?: GateRecord;
  [extra: string]: unknown;
};

export type Photo = {
  stem: string;
  file: string;
  url: string;
  sha256: string;
  meta: PhotoMeta;
  scores: Scores | null;
  split: { L: Scores; R: Scores } | null;
};

export type PhotoSet = { name: string; photos: Photo[] };
export type NoiseRow = { series: string; concern: string; n: number; mean: number; sd: number; floor: number };
export type Side = "L" | "R";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const d = body?.detail;
    throw new Error(typeof d === "string" ? d : d?.message ? `${d.code}: ${d.message}` : `HTTP ${res.status}`);
  }
  return body as T;
}

export const api = {
  sets: () => call<{ sets: { name: string; count: number }[] }>("/api/sets").then((r) => r.sets),
  set: (name: string) => call<PhotoSet>(`/api/sets/${name}`),
  reference: () => call<{ url: string; meta: PhotoMeta | null } | null>("/api/reference"),
  noise: (name: string, split: boolean) =>
    call<{ rows: NoiseRow[] }>(`/api/sets/${name}/noise?split=${split}`).then((r) => r.rows),
  analyze: (name: string, stem: string, split: boolean) =>
    call<PhotoSet>(`/api/sets/${name}/photos/${stem}/analyze?split=${split}`, { method: "POST" }),
  upload: (name: string, file: Blob, filename: string, meta: PhotoMeta, stem = "") => {
    const form = new FormData();
    form.append("file", file, filename);
    form.append("meta", JSON.stringify(meta));
    form.append("stem", stem);
    return call<Photo>(`/api/sets/${name}/photos`, { method: "POST", body: form });
  },
};
