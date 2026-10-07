// Domain rules shared by every screen: what a photo set is, how people and concerns are named.
// Mirrors app/config.py and app/trials.py on the server.
import type { Side } from "../api/types";

/** A person's photos come in three kinds, each stored as a set named `<kind>-<person>`. */
export type Kind = "trial" | "noise" | "test";

export const KINDS: Record<Kind, { label: string; hint: string }> = {
  trial: { label: "Daily check-in", hint: "One photo a day, named by days since day 0" },
  noise: { label: "Repeat photos", hint: "Same sitting, step out between shots: measures noise" },
  test: { label: "Test", hint: "Anything else; never used in results" },
};

export const setNameFor = (kind: Kind, person: string) => `${kind}-${person}`;

export function parseSetName(name: string): { kind: Kind; person: string } | null {
  const m = name.match(/^(trial|noise|test)-(.+)$/);
  return m ? { kind: m[1] as Kind, person: m[2] } : null;
}

export const SET_RE = /^[a-z0-9][a-z0-9._-]{0,60}$/i;

export const personLabel = (id: string) => id.charAt(0).toUpperCase() + id.slice(1);

export const sideLabel = (s: Side) => (s === "L" ? "Image left (their right side)" : "Image right (their left side)");
export const sideShort = (s: Side) => (s === "L" ? "image left" : "image right");

export const dayStem = (day: number) => `day-${String(day).padStart(2, "0")}`;

/** YouCam SD concerns, in display order. */
export const CONCERNS = [
  "acne", "age_spot", "redness", "radiance", "texture",
  "pore", "wrinkle", "moisture", "oiliness", "dark_circle_v2",
];

export const concernLabel = (c: string) => c.replace("_v2", "").replace(/_/g, " ");
