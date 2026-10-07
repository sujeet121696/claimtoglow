// Copies MediaPipe's wasm files and downloads the models into public/, so the capture gate and
// background removal run without a CDN. Runs on npm install (postinstall).
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";

const BASE = "https://storage.googleapis.com/mediapipe-models";
const MODELS = {
  "face_landmarker.task": `${BASE}/face_landmarker/face_landmarker/float16/1/face_landmarker.task`,
  "selfie_segmenter.tflite": `${BASE}/image_segmenter/selfie_segmenter/float16/1/selfie_segmenter.tflite`,
};

mkdirSync("public/mediapipe", { recursive: true });
cpSync("node_modules/@mediapipe/tasks-vision/wasm", "public/mediapipe/wasm", { recursive: true });

for (const [file, url] of Object.entries(MODELS)) {
  const path = `public/mediapipe/${file}`;
  if (existsSync(path)) continue;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${file} download failed: HTTP ${res.status}`);
  writeFileSync(path, Buffer.from(await res.arrayBuffer()));
}
console.log("MediaPipe assets ready in public/mediapipe");
