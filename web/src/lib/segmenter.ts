// MediaPipe selfie segmenter, served locally from public/mediapipe (see scripts/setup-assets.mjs).
// Makes a mask of the person (face, hair, body) so other devices are shown the person, not the room.
import { FilesetResolver, ImageSegmenter } from "@mediapipe/tasks-vision";

let cached: Promise<ImageSegmenter> | null = null;

async function create(delegate: "GPU" | "CPU") {
  const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
  return ImageSegmenter.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: "/mediapipe/selfie_segmenter.tflite", delegate },
    runningMode: "IMAGE",
    outputConfidenceMasks: true,
    outputCategoryMask: false,
  });
}

// CPU: the model is small, and on a phone the GPU path returned an empty mask (Oct 7).
function getSegmenter(): Promise<ImageSegmenter> {
  return (cached ??= create("CPU"));
}

/** PNG of the person mask for an upright image: white = person, black = background. */
export async function personMask(image: ImageBitmap | HTMLCanvasElement): Promise<Blob> {
  const segmenter = await getSegmenter();
  const out = { data: null as Float32Array | null, w: 0, h: 0 };
  segmenter.segment(image, (result) => {
    const masks = result.confidenceMasks ?? [];
    const person = masks[masks.length - 1]; // the person channel is the last one
    if (person) {
      out.data = person.getAsFloat32Array().slice();
      out.w = person.width;
      out.h = person.height;
    }
  });
  if (!out.data) throw new Error("No person found in the photo");

  const canvas = document.createElement("canvas");
  canvas.width = out.w;
  canvas.height = out.h;
  const ctx = canvas.getContext("2d")!;
  const img = ctx.createImageData(out.w, out.h);
  for (let i = 0; i < out.data.length; i++) {
    const v = Math.round(Math.min(1, Math.max(0, out.data[i])) * 255);
    img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = v;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return new Promise((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("PNG encode failed"))), "image/png"));
}
