// Tiny router without a library. The lab uses clean paths (/results?set=trial-sahni), served by the
// API's app fallback (app/main.py); the read-only demo keeps hash routes (#/receipt?person=sahni),
// since it is a static folder at /demo/. Links are shareable and the back button works.
// Add a page by adding it to PAGES.
import { useCallback, useEffect, useState } from "react";
import { DEMO } from "./mode";

export const PAGES = {
  today: "Today",
  capture: "Capture",
  upload: "Upload",
  results: "Results",
  timeline: "Timeline",
  receipt: "Receipt",
  login: "Sign in",
  admin: "Admin",
} as const;

export type Page = keyof typeof PAGES;

/** Pages in the top bar. The demo is read-only, so it shows only the trial's story. Sign-in and
 *  admin live in the account menu instead, so the phone's tab bar keeps six tabs. */
export const NAV: Page[] = DEMO ? ["timeline", "receipt"] : ["today", "capture", "upload", "results", "timeline", "receipt"];
const ROUTES: Page[] = DEMO ? NAV : [...NAV, "login", "admin"];
export const HOME: Page = NAV[0];
export type Route = { page: Page; params: URLSearchParams };

const PATHS = !DEMO; // clean paths in the lab, hash routes in the demo
const CHANGE = "routechange"; // fired after pushState/replaceState, which don't fire popstate

/** "results" and "set=…" from the address bar. */
function addressParts(): [string, string] {
  if (PATHS) return [window.location.pathname.replace(/^\/+|\/+$/g, ""), window.location.search.slice(1)];
  const [path, query = ""] = window.location.hash.replace(/^#\/?/, "").split("?");
  return [path, query];
}

function parse(): Route {
  const [path, query] = addressParts();
  const page = ROUTES.includes(path as Page) ? (path as Page) : HOME;
  return { page, params: new URLSearchParams(query) };
}

export function href(page: Page, params: Record<string, string> = {}) {
  const q = new URLSearchParams(params).toString();
  return `${PATHS ? "/" : "#/"}${page}${q ? `?${q}` : ""}`;
}

/** Goes to a lab address (from href) without reloading the page. */
export function navigate(to: string, { replace = false } = {}) {
  if (!PATHS) {
    if (replace) window.location.replace(to);
    else window.location.hash = to;
    return;
  }
  window.history[replace ? "replaceState" : "pushState"](null, "", to);
  if (!replace) window.scrollTo(0, 0); // a new page starts at the top, as a full page load would
  window.dispatchEvent(new Event(CHANGE));
}

/** This page as a sign-in `next` value ("/results?set=…"); Today instead of the sign-in page itself. */
export function currentPage(): string {
  const [path] = addressParts();
  if (!ROUTES.includes(path as Page) || path === "login") return href(HOME);
  return PATHS ? window.location.pathname + window.location.search : `/${window.location.hash}`;
}

/** A lab page this app shows, so links to it can be handled without a reload. */
const isPage = (pathname: string) => pathname === "/" || ROUTES.includes(pathname.replace(/^\/+|\/+$/g, "") as Page);

if (PATHS) {
  // Old links (#/capture, /?token=…#/capture from a lab QR code) become clean paths. Their query
  // values are kept, so a lab link's token still unlocks the device (lib/labToken.ts).
  if (window.location.hash.startsWith("#/")) {
    const [path, query = ""] = window.location.hash.slice(2).split("?");
    const params = new URLSearchParams(window.location.search);
    new URLSearchParams(query).forEach((v, k) => params.set(k, v));
    const q = params.toString();
    window.history.replaceState(null, "", `/${path}${q ? `?${q}` : ""}`);
  }
  // Same-tab clicks on links to lab pages change the page without a reload; everything else
  // (API sign-in links, photo downloads, new tabs, modified clicks) works as a normal link.
  document.addEventListener("click", (e) => {
    if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const a = (e.target as Element | null)?.closest?.("a");
    if (!a || (a.target && a.target !== "_self") || a.hasAttribute("download")) return;
    const url = new URL(a.href, window.location.href);
    if (url.origin !== window.location.origin || !isPage(url.pathname)) return;
    e.preventDefault();
    navigate(url.pathname + url.search);
  });
}

export function useRoute(): [Route, (page: Page, params?: Record<string, string>) => void] {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onChange = () => setRoute(parse());
    const events = PATHS ? ["popstate", CHANGE] : ["hashchange"];
    events.forEach((ev) => window.addEventListener(ev, onChange));
    return () => events.forEach((ev) => window.removeEventListener(ev, onChange));
  }, []);
  const go = useCallback((page: Page, params?: Record<string, string>) => navigate(href(page, params)), []);
  return [route, go];
}
