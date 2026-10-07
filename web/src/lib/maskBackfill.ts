// Removes the background from photos that don't have a mask yet (taken before masking existed,
// or copied in by hand). Needs the originals, so it only does anything on the lab PC.
import { api } from "../api/client";
import { personMask } from "./segmenter";

export async function saveMaskFor(setName: string, stem: string, image: Blob | ImageBitmap | HTMLCanvasElement) {
  const source = image instanceof Blob ? await createImageBitmap(image, { imageOrientation: "from-image" }) : image;
  try {
    await api.saveMask(setName, stem, await personMask(source));
  } finally {
    if (image instanceof Blob) (source as ImageBitmap).close();
  }
}

export async function maskMissing(setName: string): Promise<number> {
  const set = await api.set(setName);
  const pending = set.photos.filter((p) => !p.masked_url);
  for (const p of pending) {
    await saveMaskFor(setName, p.stem, await fetch(p.url).then((r) => {
      if (!r.ok) throw new Error(`HTTP ${r.status}`); // other devices can't load originals
      return r.blob();
    }));
  }
  return pending.length;
}
