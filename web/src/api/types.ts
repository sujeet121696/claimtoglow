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

export type VerdictRow = ConcernResult & { sd?: number; k: number; k0: number; noise_n: number };
export type TrialVerdict = { status: VerdictStatus; reason: string; concerns: VerdictRow[]; checkpoint_day: number | null };

export type Timeline = {
  person: string;
  start_date: string | null;
  duration_days: number;
  concerns: string[];
  baseline: Record<string, number | null>; // mean treated − control at day 0 + repeat photos
  k0: number;
  sd: Record<string, number | null>; // SD of treated − control over the repeat photos
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
