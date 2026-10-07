// The person's day-0 photo (trial-<person>/day-00): metrics for matching, image for the ghost overlay.
import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import { SET_RE } from "../domain/trial";
import { referenceFrom, type Reference } from "../lib/gate";

export type RefState = { ref: Reference | null; img: HTMLImageElement | null; url: string | null };

const EMPTY: RefState = { ref: null, img: null, url: null };

export function useReference(setName: string): [RefState, () => void] {
  const [state, setState] = useState<RefState>(EMPTY);
  const load = useCallback(() => {
    if (!SET_RE.test(setName)) return setState(EMPTY);
    api.reference(setName).then((r) => {
      if (!r) return setState(EMPTY);
      const img = new Image();
      img.onload = () => setState({ ref: referenceFrom(r.meta), img, url: r.url });
      img.src = r.url;
    }).catch(() => setState(EMPTY));
  }, [setName]);
  useEffect(load, [load]);
  return [state, load];
}
