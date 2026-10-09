// Tiny hash router: #/page?key=value. Links are shareable and the back button works, without a
// routing library. Add a page by adding it to PAGES.
import { useCallback, useEffect, useState } from "react";
import { DEMO } from "./mode";

export const PAGES = {
  today: "Today",
  capture: "Capture",
  upload: "Upload",
  results: "Results",
  timeline: "Timeline",
  receipt: "Receipt",
} as const;

export type Page = keyof typeof PAGES;

/** Pages in the top bar. The demo is read-only, so it shows only the trial's story. */
export const NAV: Page[] = DEMO ? ["timeline", "receipt"] : (Object.keys(PAGES) as Page[]);
export const HOME: Page = NAV[0];
export type Route = { page: Page; params: URLSearchParams };

function parse(): Route {
  const [path, query = ""] = window.location.hash.replace(/^#\/?/, "").split("?");
  const page = NAV.includes(path as Page) ? (path as Page) : HOME;
  return { page, params: new URLSearchParams(query) };
}

export function href(page: Page, params: Record<string, string> = {}) {
  const q = new URLSearchParams(params).toString();
  return `#/${page}${q ? `?${q}` : ""}`;
}

export function useRoute(): [Route, (page: Page, params?: Record<string, string>) => void] {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onChange = () => setRoute(parse());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  const go = useCallback((page: Page, params?: Record<string, string>) => {
    window.location.hash = href(page, params);
  }, []);
  return [route, go];
}
