// Tiny hash router: #/page?key=value. Links are shareable and the back button works, without a
// routing library. Add a page by adding it to PAGES.
import { useCallback, useEffect, useState } from "react";

export const PAGES = {
  today: "Today",
  capture: "Capture",
  upload: "Upload",
  results: "Results",
} as const;

export type Page = keyof typeof PAGES;
export type Route = { page: Page; params: URLSearchParams };

function parse(): Route {
  const [path, query = ""] = window.location.hash.replace(/^#\/?/, "").split("?");
  const page = (path in PAGES ? path : "today") as Page;
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
