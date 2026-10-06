// Copies MediaPipe's wasm files and downloads the face landmarker model into public/,
// so the capture gate runs without a CDN. Runs on npm install (postinstall).
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
const MODEL_PATH = "public/mediapipe/face_landmarker.task";

mkdirSync("public/mediapipe", { recursive: true });
cpSync("node_modules/@mediapipe/tasks-vision/wasm", "public/mediapipe/wasm", { recursive: true });

if (!existsSync(MODEL_PATH)) {
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`Model download failed: HTTP ${res.status}`);
  writeFileSync(MODEL_PATH, Buffer.from(await res.arrayBuffer()));
}
console.log("MediaPipe assets ready in public/mediapipe");
