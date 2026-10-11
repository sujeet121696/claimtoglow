// App-wide state: the people (trials), the selected person, and a version counter that tells pages
// to reload after something was saved. Pages read it with useStore() instead of prop drilling.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api/client";
import type { Me, Person } from "../api/types";
import { DEMO } from "./mode";
import { loadPref, savePref } from "../lib/storage";

type Editing = Person | "new" | null;

type Store = {
  people: Person[];
  today: string;
  person: Person | undefined;
  selectPerson: (id: string) => void;
  version: number;
  refresh: () => Promise<void>; // resolves once people (or the lock) and the account are loaded
  editing: Editing;
  edit: (p: Editing) => void;
  locked: string | null; // why this device is locked (no or wrong lab token), null when unlocked
  me: Me | null; // who is signed in and which sign-in methods are offered (null in the demo or until loaded)
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [today, setToday] = useState(new Date().toISOString().slice(0, 10));
  const [personId, setPersonId] = useState(() => loadPref("person"));
  const [version, setVersion] = useState(0);
  const [editing, edit] = useState<Editing>(null);
  const [locked, setLocked] = useState<string | null>(null);
  const [me, setMe] = useState<Me | null>(null);

  const refresh = useCallback(() => {
    setVersion((v) => v + 1);
    return Promise.all([
      DEMO ? null : api.me().then(setMe).catch(() => setMe(null)),
      api.people()
        .then((r) => { setPeople(r.people); setToday(r.today); setLocked(null); })
        .catch((e: Error) => {
          const lock = e.message.startsWith("Locked") ? e.message : null;
          setLocked(lock);
          if (lock) setPeople([]); // signed out or locked: don't keep showing the trials
        }),
    ]).then(() => undefined);
  }, []);
  useEffect(() => { void refresh(); }, [refresh]);

  const selectPerson = useCallback((id: string) => { setPersonId(id); savePref("person", id); }, []);
  const person = people.find((p) => p.person === personId) ?? people[0];

  const value = useMemo(
    () => ({ people, today, person, selectPerson, version, refresh, editing, edit, locked, me }),
    [people, today, person, selectPerson, version, refresh, editing, locked, me],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore outside StoreProvider");
  return store;
}
