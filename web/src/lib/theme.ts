// Colour theme: follow the device (System), or always Light or Dark. The choice is per browser.
// index.html applies it before the first paint (no flash); this keeps it in step afterwards.
import { loadPref, savePref } from "./storage";

export type Theme = "system" | "light" | "dark";
const KEY = "theme";
const dark = window.matchMedia("(prefers-color-scheme: dark)");

export function loadTheme(): Theme {
  const t = loadPref(KEY, "system");
  return t === "light" || t === "dark" ? t : "system";
}

/** Sets <html data-theme> (tokens.css) and the phone's browser bar colour to match the page. */
function apply(theme: Theme) {
  const root = document.documentElement;
  root.dataset.theme = theme === "system" ? (dark.matches ? "dark" : "light") : theme;
  const bg = getComputedStyle(root).getPropertyValue("--bg").trim();
  if (bg) document.querySelectorAll('meta[name="theme-color"]').forEach((m) => m.setAttribute("content", bg));
}

export function setTheme(theme: Theme) {
  savePref(KEY, theme);
  apply(theme);
}

/** Called once at start-up, after the styles load. */
export function initTheme() {
  apply(loadTheme());
  dark.addEventListener("change", () => { if (loadTheme() === "system") apply("system"); });
}
