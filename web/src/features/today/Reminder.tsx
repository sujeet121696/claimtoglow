// "Daily reminder" on a person's card: adds the remaining check-ins to the phone's calendar, at 7 PM
// by default, 7 AM in one tap, or any time. Each phone gets its own calendar's button: an iPhone the
// .ics file (Apple Calendar), Android the Google Calendar link (its app can't open .ics); a computer
// gets both. The other one stays as a small link for people who use a different calendar.
import { useState } from "react";
import { api } from "../../api/client";
import type { Person } from "../../api/types";
import { useStore } from "../../app/store";
import { clock } from "../../lib/time";
import { Segmented } from "../../components/ui";
import { day0Time, firstReminder, googleLink, icsFile } from "./calendar";

const when = (d: Date) => d.toLocaleString(undefined, { weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
// iPads report themselves as a Mac, but with a touch screen.
const DEVICE: "ios" | "android" | "other" =
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (/Macintosh/.test(navigator.userAgent) && navigator.maxTouchPoints > 1) ? "ios"
  : /Android/.test(navigator.userAgent) ? "android" : "other";
const PRESETS = [{ value: "07:00", label: "Morning 7 AM" }, { value: "19:00", label: "Evening 7 PM" }];

export function Reminder({ person: p }: { person: Person }) {
  const { refresh, me } = useStore();
  const [time, setTime] = useState(p.reminder_time ?? "19:00");
  // Remember the time on the server (trial.json), so every device shows when this person's reminder rings.
  const remember = () => { if (time !== p.reminder_time) api.saveReminder(p.person, time).then(refresh).catch(() => {}); };
  // The phone-reachable address (the tunnel, PUBLIC_URL), else this page's; links never carry the lab token.
  const origin = me?.public_url ?? location.origin;

  const google = time ? googleLink(p, time, origin) : null;
  const first = time ? firstReminder(p, time) : null;
  const day0 = day0Time(p);
  if (!p.start_date || (p.day !== null && p.day >= p.duration_days)) return null;

  const download = () => {
    const file = icsFile(p, time, origin);
    if (!file) return;
    remember();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(file);
    a.download = `claim-to-glow-${p.person}.ics`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };

  return (
    <details className="reminder small">
      <summary>Daily reminder{p.reminder_time ? ` · ${clock(p.reminder_time)}` : " · not set"}</summary>
      <div className="reminder-row">
        <Segmented options={PRESETS} value={time} onChange={setTime} />
        <label>or <input type="time" aria-label="Reminder time" value={time} onChange={(e) => setTime(e.target.value)} required /></label>
      </div>
      <div className="reminder-row">
        {DEVICE === "ios" && <>
          <button className="small primary" disabled={!time} onClick={download}>Add to Calendar</button>
          {google && <a className="link-button" href={google} onClick={remember} target="_blank" rel="noopener noreferrer">Use Google Calendar</a>}
        </>}
        {DEVICE === "android" && <>
          {google && <a className="button small primary" href={google} onClick={remember} target="_blank" rel="noopener noreferrer">Add to Google Calendar</a>}
          <button className="link-button" disabled={!time} onClick={download}>Other calendar (.ics)</button>
        </>}
        {DEVICE === "other" && <>
          {google && <a className="button small" href={google} onClick={remember} target="_blank" rel="noopener noreferrer">Google Calendar</a>}
          <button className="small" disabled={!time} onClick={download}>Apple / Outlook (.ics)</button>
        </>}
      </div>
      <p className="muted reminder-note">
        {first && <>Daily until day {p.duration_days}, from {when(first)}. </>}
        {day0 && <>Day 0 was at {day0}. </>}
        {DEVICE !== "ios" && "In Google Calendar, set the notification to 0 minutes to ring on time."}
      </p>
    </details>
  );
}
