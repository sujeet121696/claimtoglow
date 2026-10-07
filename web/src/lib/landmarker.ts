// MediaPipe face landmarker, served locally from public/mediapipe (see scripts/setup-assets.mjs).
import { FaceLandmarker, FilesetResolver } from "@mediapipe/tasks-vision";

type Mode = "VIDEO" | "IMAGE";
const cache: Partial<Record<Mode, Promise<FaceLandmarker>>> = {};

async function create(mode: Mode, delegate: "GPU" | "CPU") {
  const fileset = await FilesetResolver.forVisionTasks("/mediapipe/wasm");
  return FaceLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: "/mediapipe/face_landmarker.task", delegate },
    runningMode: mode,
    numFaces: 2, // so "more than one face" can fail the gate
    outputFaceBlendshapes: true,
  });
}

export function getLandmarker(mode: Mode): Promise<FaceLandmarker> {
  return (cache[mode] ??= create(mode, "GPU").catch(() => create(mode, "CPU")));
}
