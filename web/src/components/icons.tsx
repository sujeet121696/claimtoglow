// Line icons for the navigation (24×24, stroke = currentColor, so they follow the text colour).
import type { Page } from "../app/router";

const PATHS: Record<Page, string> = {
  today: "M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4 7 17M17 7l1.4-1.4M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z",
  capture: "M4 8h3l2-3h6l2 3h3v11H4zM12 10a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7z",
  upload: "M12 15V4M7.5 8.5 12 4l4.5 4.5M4 15v4h16v-4",
  results: "M5 20V11M10 20V5M15 20v-6M20 20V9",
  timeline: "M3 17l5-5 4 3 8-8M15 7h5v5",
  receipt: "M6 3h12v18l-3-2-3 2-3-2-3 2zM9 8h6M9 12h6M9 16h3",
};

export function PageIcon({ page }: { page: Page }) {
  return (
    <svg className="icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={PATHS[page]} />
    </svg>
  );
}
