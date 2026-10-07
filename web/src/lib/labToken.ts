// Another device unlocks the lab with the lab token. The server checks it and sets an HttpOnly
// cookie, which API calls and photo URLs then carry. Two ways in: opening the lab link
// (…/?token=…), or pasting that link on the lock screen (when a sign-in step drops ?token).
import { api } from "../api/client";

/** The token from a pasted lab link, or the bare token itself. */
export function tokenFrom(text: string): string | null {
  const s = text.trim();
  if (!s) return null;
  const m = s.match(/[?&]token=([^&#\s]+)/);
  if (m) return decodeURIComponent(m[1]);
  return /^[\w-]{12,}$/.test(s) ? s : null;
}

/** Unlocks with ?token= from the address bar, if any, and removes it from the address bar. */
export async function adoptTokenFromUrl(): Promise<void> {
  const url = new URL(window.location.href);
  const token = url.searchParams.get("token");
  if (!token) return;
  url.searchParams.delete("token");
  window.history.replaceState(null, "", url.pathname + url.search + url.hash);
  await api.unlock(token).catch(() => undefined); // a wrong token just leaves the lock screen up
}
