// Daily selfie reminders as calendar events: the phone's own calendar rings, so there is no email or
// SMS service, account or key. Times are "floating" (no time zone), so they ring at that local time.
// Checkpoint days (7, 14, … and the last day) get their own event instead of the daily one.
import { href } from "../../app/router";
import type { Person } from "../../api/types";
import { personLabel } from "../../domain/trial";

const CHECKPOINT_EVERY = 7; // as app/trials.py
const MINUTES = 15;

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (d: Date) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`;
const stamp = (d: Date) => `${ymd(d)}T${pad(d.getHours())}${pad(d.getMinutes())}00`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
const isCheckpoint = (day: number, duration: number) => day > 0 && (day % CHECKPOINT_EVERY === 0 || day === duration);

/** Day 0's time of day ("4:49 PM"), shown as a hint: photos near it get the same light. */
export function day0Time(p: Person): string | null {
  return p.day0?.saved_at ? new Date(p.day0.saved_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" }) : null;
}

type Plan = { first: Date; days: number; firstDay: number; checkpoints: { day: number; at: Date }[] };

/** The remaining trial days from today (or day 1), at the given time; null when nothing is left. */
function plan(p: Person, time: string): Plan | null {
  if (!p.start_date) return null;
  const [y, m, d] = p.start_date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const start = new Date(y, m - 1, d, hh, mm);
  // Today only if the time is still ahead; a reminder in the past never rings.
  let firstDay = Math.max(1, p.day ?? 1);
  if (addDays(start, firstDay).getTime() <= Date.now()) firstDay++;
  const days = p.duration_days - firstDay + 1;
  if (days < 1) return null;
  const checkpoints = [];
  for (let day = firstDay; day <= p.duration_days; day++) {
    if (isCheckpoint(day, p.duration_days)) checkpoints.push({ day, at: addDays(start, day) });
  }
  return { first: addDays(start, firstDay), days, firstDay, checkpoints };
}

// origin: the lab's address without the token (calendars sync to other services, so no secrets).
/** When the first reminder rings, to show next to the time field. */
export const firstReminder = (p: Person, time: string) => plan(p, time)?.first ?? null;

const lab = (p: Person, origin: string) => `${origin}/${href("capture", { kind: "trial", person: p.person })}`;
const title = (p: Person) => `Claim to Glow: ${personLabel(p.person)}'s selfie`;
const details = (p: Person, origin: string) => `Same spot, same light, same camera as day 0. Open the camera: ${lab(p, origin)}`;

// iCalendar text: commas, semicolons and backslashes escaped, lines folded at 75 octets.
const esc = (s: string) => s.replace(/[\\;,]/g, (c) => `\\${c}`).replace(/\n/g, "\\n");
function fold(line: string) {
  const out: string[] = [];
  for (let s = line; s.length; s = s.slice(73)) out.push(s.slice(0, 73));
  return out.join("\r\n ");
}

function event(uid: string, at: Date, summary: string, description: string, extra: string[] = []) {
  return [
    "BEGIN:VEVENT", `UID:${uid}`, `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(at)}`, `DTEND:${stamp(new Date(at.getTime() + MINUTES * 60_000))}`,
    ...extra, `SUMMARY:${esc(summary)}`, `DESCRIPTION:${esc(description)}`,
    "BEGIN:VALARM", "ACTION:DISPLAY", `DESCRIPTION:${esc(summary)}`, "TRIGGER:PT0M", "END:VALARM",
    "END:VEVENT",
  ];
}

/** A .ics file with the daily series and one event per checkpoint day; null when the trial is over. */
export function icsFile(p: Person, time: string, origin: string): Blob | null {
  const pl = plan(p, time);
  if (!pl) return null;
  const id = `${p.person}-${p.start_date}@claimtoglow`;
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Claim to Glow//Reminders//EN", "CALSCALE:GREGORIAN",
    ...event(`daily-${id}`, pl.first, title(p), details(p, origin), [
      `RRULE:FREQ=DAILY;COUNT=${pl.days}`,
      ...pl.checkpoints.map((c) => `EXDATE:${stamp(c.at)}`),
    ]),
    ...pl.checkpoints.flatMap((c) => event(`day${c.day}-${id}`, c.at, `${title(p)}: checkpoint day ${c.day}`,
      `3 photos today, stepping out of frame between shots, then analyse them today. ${details(p, origin)}`)),
    "END:VCALENDAR",
  ];
  return new Blob([lines.map(fold).join("\r\n") + "\r\n"], { type: "text/calendar;charset=utf-8" });
}

/** Google Calendar "add event" link for the daily series (one event per link, so checkpoints are named in the text). */
export function googleLink(p: Person, time: string, origin: string): string | null {
  const pl = plan(p, time);
  if (!pl) return null;
  const end = new Date(pl.first.getTime() + MINUTES * 60_000);
  const cps = pl.checkpoints.map((c) => c.day).join(", ");
  const q = new URLSearchParams({
    action: "TEMPLATE",
    text: title(p),
    dates: `${stamp(pl.first)}/${stamp(end)}`,
    ctz: Intl.DateTimeFormat().resolvedOptions().timeZone,
    recur: `RRULE:FREQ=DAILY;COUNT=${pl.days}`,
    details: `${details(p, origin)}${cps ? `\nCheckpoint days (3 photos, analyse the same day): ${cps}.` : ""}`,
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}
