// Pure helpers for the Results page: which scores to show, set grouping and labels.
import type { Person, Photo, Scores, SetSummary, Side } from "../../api/types";
import { KINDS, parseSetName, personLabel, type Kind } from "../../domain/trial";

/** Whole face, one mirrored half, or treated minus control (what a split-face verdict uses). */
export type ScoreView = "whole" | "L" | "R" | "T-C";

/** Which noise series sets the floor for each view (L−R and T−C have the same spread). */
export const FLOOR_SERIES: Record<ScoreView, string> = { whole: "photo", L: "L", R: "R", "T-C": "L-R" };

export function viewScores(p: Photo, view: ScoreView, side: Side): Scores | null {
  if (view === "whole") return p.scores;
  if (!p.split) return null;
  if (view !== "T-C") return p.split[view];
  const t = p.split[side];
  const c = p.split[side === "L" ? "R" : "L"];
  return Object.fromEntries(Object.keys(t).filter((k) => k in c).map((k) => [k, t[k] - c[k]]));
}

export function setLabel(name: string, people: Person[]) {
  const parsed = parseSetName(name);
  return parsed && people.some((p) => p.person === parsed.person)
    ? `${personLabel(parsed.person)} · ${KINDS[parsed.kind].label}`
    : name;
}

/** Sets grouped by person (daily, repeat, test), then everything else under "Other". */
export function groupSets(sets: SetSummary[], people: Person[]) {
  const order = Object.keys(KINDS) as Kind[];
  const groups = people.map((p) => ({ label: personLabel(p.person), sets: [] as SetSummary[] }));
  const other: SetSummary[] = [];
  for (const s of sets) {
    const parsed = parseSetName(s.name);
    const i = parsed ? people.findIndex((p) => p.person === parsed.person) : -1;
    (i >= 0 ? groups[i].sets : other).push(s);
  }
  for (const g of groups) g.sets.sort((a, b) => order.indexOf(parseSetName(a.name)!.kind) - order.indexOf(parseSetName(b.name)!.kind));
  return [...groups.filter((g) => g.sets.length), ...(other.length ? [{ label: "Other", sets: other }] : [])];
}
