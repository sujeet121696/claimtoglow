// Runs the capture gate on photos copied into a folder by hand (no gate result yet) and stores it.
// Day 0 is checked on its own first; every other photo is also matched against it.
import { api } from "../api/client";
import { gateImage, referenceFrom, type Reference } from "./gate";
import { getLandmarker } from "./landmarker";

export async function checkUnchecked(setName: string): Promise<number> {
  const set = await api.set(setName);
  const pending = set.photos.filter((p) => !p.meta.gate);
  if (!pending.length) return 0;

  const landmarker = await getLandmarker("IMAGE");
  const canvas = document.createElement("canvas");
  const isDay0 = (stem: string) => setName.startsWith("trial-") && stem === "day-00";
  pending.sort((a, b) => Number(isDay0(b.stem)) - Number(isDay0(a.stem)));

  let ref: Reference | null | undefined;
  for (const p of pending) {
    if (!isDay0(p.stem) && ref === undefined) ref = referenceFrom((await api.reference(setName))?.meta ?? null);
    const bitmap = await createImageBitmap(await fetch(p.url).then((r) => r.blob()), { imageOrientation: "from-image" });
    await api.saveGate(setName, p.stem, gateImage(landmarker, bitmap, isDay0(p.stem) ? null : ref ?? null, canvas));
    bitmap.close();
  }
  return pending.length;
}
