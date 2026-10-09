// Install as an app on the phone's home screen. Chrome/Edge (Android, desktop) offer a prompt we
// can trigger; iPhone Safari has none, so there the person is told to use Share → Add to Home Screen.
import { useEffect, useState } from "react";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

// The browser may fire this before React mounts, so it is caught as soon as this module loads.
let deferred: InstallPrompt | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault(); // show our own button instead of the browser's mini bar
  deferred = e as InstallPrompt;
  notify();
});
window.addEventListener("appinstalled", () => { deferred = null; notify(); });

export const installed = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;

export const isIos = () =>
  /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.userAgent.includes("Macintosh") && navigator.maxTouchPoints > 1);

/** "prompt" when the browser can install it, "ios" for the manual steps, null when there's nothing to offer. */
export function useInstall(): ["prompt" | "ios" | null, () => Promise<void>] {
  const [, rerender] = useState(0);
  useEffect(() => {
    const l = () => rerender((n) => n + 1);
    listeners.add(l);
    return () => { listeners.delete(l); };
  }, []);

  const mode = installed() ? null : deferred ? "prompt" : isIos() ? "ios" : null;
  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    deferred = null; // a prompt can be used once
    notify();
  }
  return [mode, install];
}
