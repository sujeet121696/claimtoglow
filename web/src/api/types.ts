// Shapes returned by the local API (app/main.py). Kept separate from the client so features can
// import types without pulling in fetch code.
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
  noise_count: number;
  noise_target: number;
  day0: { url: string; saved_at: string | null; gate_passed: boolean | null; failed: string[] } | null;
  verdict: { status: VerdictStatus; reason: string };
};

export type VerdictStatus = "met" | "not met" | "not enough evidence";

export type ClaimSuggestion = { concerns: string[]; deadline_days: number | null; rationale: string; model: string };

export type TrialFields = Pick<Person, "product" | "claim" | "concerns" | "notes" | "treated_side" | "start_date" | "duration_days">;
