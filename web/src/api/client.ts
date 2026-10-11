// Client for the local API (app/main.py), proxied by Vite. One function per endpoint, so each maps
// 1:1 to a future agent tool (VISION D1, D2). In demo mode the read-only calls load the exported
// files in data/ instead (scripts/export_demo.py).
import { DEMO } from "../app/mode";
import type { GateRecord } from "../lib/gate";
import type { ClaimSuggestion, NoiseRow, Person, Photo, PhotoMeta, PhotoSet, Receipt, SetSummary, Timeline, TrialFields } from "./types";

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, init);
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    const d = body?.detail;
    throw new Error(typeof d === "string" ? d : d?.message ? `${d.code}: ${d.message}` : `HTTP ${res.status}`);
  }
  return body as T;
}

const json = (method: string, data: unknown): RequestInit => ({
  method,
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify(data),
});

/** Live endpoint in the lab, exported file in the demo (relative, so the demo works under any path). */
const source = (live: string, file: string) => (DEMO ? `data/${file}` : live);

export const api = {
  people: () => call<{ people: Person[]; today: string }>(source("/api/people", "people.json")),
  timeline: (person: string) => call<Timeline>(source(`/api/people/${person}/timeline`, `${person}/timeline.json`)),
  receipt: (person: string) => call<Receipt>(source(`/api/people/${person}/receipt`, `${person}/receipt.json`)),
  badgeUrl: (person: string) => source(`/api/people/${person}/badge.svg`, `${person}/badge.svg`),
  unlock: (token: string) => call<{ unlocked: boolean }>("/api/unlock", json("POST", { token })),
  parseClaim: (claim: string, product: string) =>
    call<ClaimSuggestion>("/api/claims/parse", json("POST", { claim, product })),
  labLink: () => call<{ wifi: string; public: string | null }>("/api/lab-link"),
  savePerson: (person: string, fields: TrialFields) => call<Person>(`/api/people/${person}`, json("PUT", fields)),
  saveReminder: (person: string, time: string) => call<Person>(`/api/people/${person}/reminder`, json("PUT", { time })),

  sets: () => call<{ sets: SetSummary[] }>("/api/sets").then((r) => r.sets),
  set: (name: string) => call<PhotoSet>(`/api/sets/${name}`),
  reference: (name: string) =>
    call<{ set: string; url: string; masked_url: string | null; meta: PhotoMeta | null } | null>(`/api/sets/${name}/reference`),
  noise: (name: string, split: boolean) =>
    call<{ rows: NoiseRow[] }>(`/api/sets/${name}/noise?split=${split}`).then((r) => r.rows),

  upload: (name: string, file: Blob, filename: string, meta: PhotoMeta, stem = "") => {
    const form = new FormData();
    form.append("file", file, filename);
    form.append("meta", JSON.stringify(meta));
    form.append("stem", stem);
    return call<Photo>(`/api/sets/${name}/photos`, { method: "POST", body: form });
  },
  saveMask: (name: string, stem: string, png: Blob) => {
    const form = new FormData();
    form.append("file", png, `${stem}.png`);
    return call<Photo>(`/api/sets/${name}/photos/${stem}/mask`, { method: "POST", body: form });
  },
  saveGate: (name: string, stem: string, gate: GateRecord) =>
    call<Photo>(`/api/sets/${name}/photos/${stem}/gate`, json("POST", { gate })),
  analyze: (name: string, stem: string, split: boolean) =>
    call<PhotoSet>(`/api/sets/${name}/photos/${stem}/analyze?split=${split}`, { method: "POST" }),
  retire: (name: string, stem: string) =>
    call<{ moved_to: string }>(`/api/sets/${name}/photos/${stem}/retire`, { method: "POST" }),
};
