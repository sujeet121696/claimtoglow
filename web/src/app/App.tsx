// App shell: top bar (brand, navigation, person) and the current page.
import type { ComponentType } from "react";
import { CapturePage } from "../features/capture/CapturePage";
import { PersonEditor } from "../features/people/PersonEditor";
import { PersonPicker } from "../features/people/PersonPicker";
import { ResultsPage } from "../features/results/ResultsPage";
import { TodayPage } from "../features/today/TodayPage";
import { UploadPage } from "../features/upload/UploadPage";
import { Empty } from "../components/ui";
import { LockScreen } from "./LockScreen";
import { href, PAGES, useRoute, type Page } from "./router";
import { StoreProvider, useStore } from "./store";

const VIEWS: Record<Page, ComponentType> = {
  today: TodayPage,
  capture: CapturePage,
  upload: UploadPage,
  results: ResultsPage,
};

function Shell() {
  const [route] = useRoute();
  const { people, editing, locked } = useStore();
  const View = VIEWS[route.page];
  const needsPerson = route.page !== "today" && !people.length;

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href={href("today")} aria-label="Claim to Glow home">
          <img className="logo" src="/favicon.svg" alt="" width={34} height={34} />
          <span>Claim to <b>Glow</b></span>
        </a>
        <nav aria-label="Main">
          {(Object.keys(PAGES) as Page[]).map((p) => (
            <a key={p} href={href(p)} aria-current={route.page === p ? "page" : undefined}>{PAGES[p]}</a>
          ))}
        </nav>
        {people.length > 0 && <PersonPicker />}
      </header>

      <main className="page">
        {locked ? (
          <LockScreen reason={locked} />
        ) : needsPerson ? <Empty>Add a person on the Today page first.</Empty> : <View />}
      </main>

      <footer className="footer muted small">Cosmetic skin metrics only, not a diagnosis. Photos stay on this machine.</footer>

      {editing && <PersonEditor key={editing === "new" ? "new" : editing.person} />}
    </div>
  );
}

export function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
