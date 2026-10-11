// Client for the local API (app/main.py), proxied by Vite. One function per endpoint, so each maps
// 1:1 to a future agent tool (VISION D1, D2). In demo mode the read-only calls load the exported
// files in data/ instead (scripts/export_demo.py).
import { DEMO } from "../app/mode";
import type { GateRecord } from "../lib/gate";
import type { AdminOverview, AdminUser, ClaimSuggestion, Me, NewUser, NoiseRow, Person, Photo, PhotoMeta, PhotoSet, Receipt, RemoteAccess, SetSummary, Timeline, TrialFields } from "./types";

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
  me: () => call<Me>("/api/me"),
  passwordLogin: (login: string, password: string) => call<{ signed_in: boolean }>("/api/auth/password", json("POST", { login, password })),
  /** Mails a one-time sign-in link (to invited emails only; the reply is the same either way). */
  emailLink: (email: string, next: string) => call<null>("/api/auth/email", json("POST", { email, next })),
  emailVerify: (token: string) => call<{ signed_in: boolean }>("/api/auth/email-verify", json("POST", { token })),
  logout: () => call<{ signed_in: boolean }>("/api/auth/logout", { method: "POST" }),
  /** Full-page sign-in with a provider; comes back to `next` (a lab page such as /admin). */
  oauthUrl: (provider: string, next: string) => `/api/auth/start?${new URLSearchParams({ provider, next })}`,
  admin: {
    overview: () => call<AdminOverview>("/api/admin/overview"),
    users: () => call<{ users: AdminUser[] }>("/api/admin/users").then((r) => r.users),
    addUser: (user: NewUser) => call<{ users: AdminUser[] }>("/api/admin/users", json("POST", user)).then((r) => r.users),
    changeUser: (id: number, change: { admin?: boolean; disabled?: boolean; password?: string }) =>
      call<{ users: AdminUser[] }>(`/api/admin/users/${id}`, json("PATCH", change)).then((r) => r.users),
    removeUser: (id: number) => call<{ users: AdminUser[] }>(`/api/admin/users/${id}`, { method: "DELETE" }).then((r) => r.users),
    saveSettings: (settings: { remote_access?: RemoteAccess; units_granted?: Record<string, number> }) =>
      call<AdminOverview>("/api/admin/settings", json("PUT", settings)),
  },
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
