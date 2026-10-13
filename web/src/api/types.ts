// Shapes returned by the local API (app/main.py). Kept separate from the client so features can
// import types without pulling in fetch code.
import type { ChangeResult } from "../domain/trial";
import type { GateRecord } from "../lib/gate";

export type Side = "L" | "R";
export type Scores = Record<string, number>;

export type PhotoMeta = {
  sha256?: string;
  saved_at?: string;
  source?: "camera" | "upload" | "folder";
  treated_side?: Side;
  gate?: GateRecord;
  [extra: string]: unknown;
};

export type Photo = {
  stem: string;
  file: string;
  url: string;
  masked_url: string | null; // background removed: what other devices see
  sha256: string;
  tampered: boolean;
  meta: PhotoMeta;
  scores: Scores | null;
  split: { L: Scores; R: Scores } | null;
};

export type PhotoSet = { name: string; key_var: string; photos: Photo[] };
export type SetSummary = { name: string; count: number };
export type NoiseRow = { series: string; concern: string; n: number; mean: number; sd: number; floor: number };

export type Person = {
  person: string;
  product: string;
  claim: string;
  concerns: string[];
  notes: string;
  treated_side: Side;
  start_date: string | null;
  duration_days: number;
  reminder_time: string | null; // "19:00": the daily calendar reminder, once added
  key_var: string;
  day: number | null;
  checkins: string[];
  today_done: boolean;
  today_count: number; // photos taken today
  today_target: number; // 3 on a checkpoint day (day 7, 14, 21), 0 once the trial has ended, else 1
  today_next: string | null; // name of the next photo, e.g. day-07b
  // newest check-in after day 0, with its capture-gate result
  latest: { stem: string; url: string; masked_url: string | null; gate_passed: boolean | null; failed: string[] } | null;
  noise_count: number;
  noise_target: number;
  day0: { url: string; masked_url: string | null; saved_at: string | null; gate_passed: boolean | null; failed: string[] } | null;
  verdict: { status: VerdictStatus; reason: string; concerns: ConcernResult[] };
};

export type VerdictStatus = "met" | "not met" | "not enough evidence";

/** One claimed concern in the verdict (app/verdict.py): change since day 0 vs the noise floor. */
export type ConcernResult = { concern: string; result: ChangeResult; effect?: number; floor?: number };

export type ClaimSuggestion = { concerns: string[]; deadline_days: number | null; rationale: string; model: string };

export type TrialFields = Pick<Person, "product" | "claim" | "concerns" | "notes" | "treated_side" | "start_date" | "duration_days">;

/** One check-in on the timeline (app/receipt.py). `tc` is treated − control per concern, null until analysed. */
export type TimelineEntry = {
  stem: string;
  day: number | null;
  checkpoint: boolean;
  saved_at: string | null;
  sha256: string;
  tampered: boolean;
  gate_passed: boolean | null;
  failed: string[];
  masked_url: string | null;
  tc: Scores | null;
};

export type VerdictRow = ConcernResult & { sd?: number; sd_between?: number; k: number; k0: number; noise_n: number; days_n: number };
export type TrialVerdict = { status: VerdictStatus; reason: string; concerns: VerdictRow[]; checkpoint_day: number | null };

export type Timeline = {
  person: string;
  start_date: string | null;
  duration_days: number;
  concerns: string[];
  baseline: Record<string, number | null>; // mean treated − control at day 0 + repeat photos
  k0: number;
  sd: Record<string, number | null>; // SD of treated − control over the repeat photos
  band: Record<string, number | null>; // noise one photo can move vs baseline, within a sitting and between days
  entries: TimelineEntry[];
  verdict: TrialVerdict;
};

export type ReceiptPhoto = Pick<TimelineEntry, "stem" | "saved_at" | "sha256" | "tampered" | "gate_passed" | "failed">;

/** The public, face-free record of a trial. receipt_hash is SHA-256 over everything but generated_at. */
export type Receipt = {
  person: string;
  product: string;
  claim: string;
  concerns: string[];
  treated_side: Side;
  start_date: string | null;
  duration_days: number;
  verdict: TrialVerdict;
  method: string;
  photos: { daily: ReceiptPhoto[]; repeat: ReceiptPhoto[] };
  generated_at: string;
  receipt_hash: string;
};

// Sign-in (app/auth.py) and the admin page (app/admin.py).
export type SignInMethod = "google" | "github" | "linkedin" | "email" | "password";
export type Me = {
  user: { email: string; username: string | null; name: string | null; admin: boolean } | null;
  methods: SignInMethod[];
  lab_links: boolean; // a pasted lab link still opens the lab (Admin → Settings → Who gets in)
  public_url: string | null; // the tunnel's address, when set (PUBLIC_URL)
};
export type RemoteAccess = "link_or_signin" | "signin_only";
export type AdminTrial = {
  person: string; product: string; day: number | null; duration_days: number;
  today_count: number; today_target: number; today_done: boolean;
  latest: { stem: string; gate_passed: boolean | null } | null;
  verdict: VerdictStatus; reminder_time: string | null; key_var: string;
};
export type KeyUsage = { key_var: string; analyses: number; units_used: number; units_granted: number | null; units_left: number | null };
export type AccessEntry = {
  at: string; event: "sign-in" | "sign-out" | "lab-open" | "unlock" | "admin"; email: string | null;
  method: string | null; ip: string | null; device: string | null; ok: number; detail: string | null;
};
export type AdminOverview = {
  trials: AdminTrial[]; usage: KeyUsage[]; units_per_analysis: number; log: AccessEntry[];
  settings: { remote_access: RemoteAccess };
};
export type AdminUser = {
  id: number; email: string; username: string | null; name: string | null; admin: boolean; owner: boolean;
  disabled: boolean; has_password: boolean; methods: string[]; created_at: string; last_seen_at: string | null;
};
export type NewUser = { email: string; username: string; name: string; admin: boolean; password: string };
