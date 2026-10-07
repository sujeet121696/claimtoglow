// Per-browser preferences (last tab, last person). Wrapped because storage can be blocked.
export function loadPref(key: string, fallback = ""): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

export function savePref(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* blocked storage: the choice just won't stick */
  }
}
