// App-wide state: the people (trials), the selected person, and a version counter that tells pages
// to reload after something was saved. Pages read it with useStore() instead of prop drilling.
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { api } from "../api/client";
import type { Person } from "../api/types";
import { loadPref, savePref } from "../lib/storage";

type Editing = Person | "new" | null;

type Store = {
  people: Person[];
  today: string;
  person: Person | undefined;
  selectPerson: (id: string) => void;
  version: number;
  refresh: () => void;
  editing: Editing;
  edit: (p: Editing) => void;
  locked: string | null; // why this device is locked (no or wrong lab token), null when unlocked
};

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [people, setPeople] = useState<Person[]>([]);
  const [today, setToday] = useState(new Date().toISOString().slice(0, 10));
  const [personId, setPersonId] = useState(() => loadPref("person"));
  const [version, setVersion] = useState(0);
  const [editing, edit] = useState<Editing>(null);
  const [locked, setLocked] = useState<string | null>(null);

  const refresh = useCallback(() => {
    api.people()
      .then((r) => { setPeople(r.people); setToday(r.today); setLocked(null); })
      .catch((e: Error) => setLocked(e.message.startsWith("Locked") ? e.message : null));
    setVersion((v) => v + 1);
  }, []);
  useEffect(refresh, [refresh]);

  const selectPerson = useCallback((id: string) => { setPersonId(id); savePref("person", id); }, []);
  const person = people.find((p) => p.person === personId) ?? people[0];

  const value = useMemo(
    () => ({ people, today, person, selectPerson, version, refresh, editing, edit, locked }),
    [people, today, person, selectPerson, version, refresh, editing, locked],
  );
  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const store = useContext(StoreContext);
  if (!store) throw new Error("useStore outside StoreProvider");
  return store;
}
