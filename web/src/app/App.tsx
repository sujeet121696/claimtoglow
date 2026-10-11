// App shell: top bar (brand, navigation, person) and the current page.
import { useEffect, type ComponentType } from "react";
import { AdminPage } from "../features/account/AdminPage";
import { LoginPage } from "../features/account/LoginPage";
import { CapturePage } from "../features/capture/CapturePage";
import { PersonEditor } from "../features/people/PersonEditor";
import { PersonPicker } from "../features/people/PersonPicker";
import { ReceiptPage } from "../features/receipt/ReceiptPage";
import { ResultsPage } from "../features/results/ResultsPage";
import { TimelinePage } from "../features/timeline/TimelinePage";
import { TodayPage } from "../features/today/TodayPage";
import { UploadPage } from "../features/upload/UploadPage";
import { PageIcon } from "../components/icons";
import { Empty } from "../components/ui";
import { AccountMenu } from "./AccountMenu";
import { InstallButton } from "./InstallButton";
import { DEMO } from "./mode";
import { currentPage, HOME, href, NAV, navigate, PAGES, useRoute, type Page } from "./router";
import { StoreProvider, useStore } from "./store";

const VIEWS: Record<Page, ComponentType> = {
  today: TodayPage,
  capture: CapturePage,
  upload: UploadPage,
  results: ResultsPage,
  timeline: TimelinePage,
  receipt: ReceiptPage,
  login: LoginPage,
  admin: AdminPage,
};

// Pages that work without a trial and on a locked device (signing in is how it unlocks).
const STANDALONE: Page[] = ["login", "admin"];

function Shell() {
  const [route] = useRoute();
  const { people, editing, locked, selectPerson } = useStore();
  const View = VIEWS[route.page];
  const standalone = STANDALONE.includes(route.page);
  const needsPerson = route.page !== "today" && !standalone && !people.length;
  // Shared links name the person (/receipt?person=sahni).
  const linked = route.params.get("person");
  useEffect(() => { if (linked) selectPerson(linked); }, [linked, selectPerson]);
  // A device the server won't let in goes to the sign-in page first, then back to where it was.
  useEffect(() => {
    if (locked && !standalone) navigate(href("login", { next: currentPage() }), { replace: true });
  }, [locked, standalone]);

  return (
    <div className="app">
      <header className="topbar">
        <a className="brand" href={href(HOME)} aria-label="Claim to Glow home">
          <img className="logo" src={`${import.meta.env.BASE_URL}favicon.svg`} alt="" width={34} height={34} />
          <span>Claim to <b>Glow</b></span>
        </a>
        {/* Top links on a wide screen, a bottom tab bar on a phone (base.css). */}
        <nav className="main-nav" aria-label="Main">
          {NAV.map((p) => (
            <a key={p} href={href(p)} aria-current={route.page === p ? "page" : undefined}>
              <PageIcon page={p} />
              <span>{PAGES[p]}</span>
            </a>
          ))}
        </nav>
        {people.length > 0 && <PersonPicker />}
        {!DEMO && <InstallButton />}
        {!DEMO && <AccountMenu />}
      </header>

      <main className="page" key={route.page}>
        {locked && !standalone ? null : needsPerson ? <Empty>{DEMO ? "Loading the trial data…" : "Add a person on the Today page first."}</Empty> : <View />}
      </main>

      <footer className="footer muted small">
        Cosmetic skin metrics only, not a diagnosis.{" "}
        {DEMO ? "Read-only demo with the real trial data; photos are not included, only their fingerprints." : "Photos stay on this machine."}
      </footer>

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
