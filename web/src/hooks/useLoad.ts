// Loads data for the current page and reloads when its inputs change (or after a save: version).
import { useEffect, useState } from "react";

export function useLoad<T>(load: (() => Promise<T>) | null, deps: unknown[]): { data: T | null; error: string } {
  const [state, setState] = useState<{ data: T | null; error: string }>({ data: null, error: "" });
  useEffect(() => {
    if (!load) return;
    let live = true;
    load()
      .then((data) => live && setState({ data, error: "" }))
      .catch((e: Error) => live && setState({ data: null, error: e.message }));
    return () => { live = false; };
  }, deps);
  return state;
}
