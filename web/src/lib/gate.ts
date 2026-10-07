// Capture gate: turns face landmarks + pixels into pass/fail checks, so every photo in a trial is
// taken under the same conditions. Thresholds follow YouCam's photo rules (face 60–80% of image
// width, front-facing, neutral, bright even light) plus split-face needs (nose centred, both halves
// lit the same). All thresholds live in LIMITS so they can be tuned from real captures.
import type { FaceLandmarker, FaceLandmarkerResult } from "@mediapipe/tasks-vision";

export const LIMITS = {
  faceWidth: [0.55, 0.78], // landmark width; YouCam accepted 0.55 here (its "60%" counts a wider face box)
  noseOffset: 0.03, // |nose x − centre| as a fraction of image width (split line)
  yaw: 0.06, // nose offset from cheek midpoint, fraction of face width
  roll: 4, // degrees
  pitch: [0.22, 0.5], // (nose − eyes) / (chin − eyes), vertical
  jawOpen: 0.12,
  smile: 0.35,
  blink: 0.5,
  luma: [80, 210], // mean face brightness, 0–255
  clipped: 0.03, // share of blown-out face pixels
  balance: 0.1, // |left − right| / mean brightness of the two face halves
  minShortSide: 480, // YouCam SD minimum
  // vs day 0. lightSide: which half is brighter, signed. On Oct 7 a 50-minute shift in window light
  // moved treated − control scores by 2–4× the noise, so the light's direction must match too.
  match: { faceWidth: 0.04, noseX: 0.03, pitch: 0.04, luma: 0.15, lightSide: 0.04 },
};

export type Crop = { x: number; y: number; w: number; h: number };

export type Metrics = {
  faces: number;
  faceWidth: number;
  inBounds: boolean;
  noseX: number;
  yaw: number;
  roll: number;
  pitch: number;
  jawOpen: number;
  smile: number;
  blink: number;
  luma: number;
  balance: number;
  lightSide: number; // (left − right) / mean brightness of the face halves, in image space
  clipped: number;
  shortSide: number;
  width: number; // saved image size: a different size means a different camera or mode
  height: number;
};

/** What a new photo must match from day 0. Older day-0 records may lack the newer fields. */
export type Reference = Pick<Metrics, "faceWidth" | "noseX" | "pitch" | "luma"> &
  Partial<Pick<Metrics, "lightSide" | "width" | "height">>;

export type Check = { id: string; label: string; pass: boolean; value: string; hint: string };

/** Landscape sources (laptop webcams) are cropped to a centred 3:4 portrait so the face can fill 60–80%. */
export function portraitCrop(sw: number, sh: number): Crop {
  if (sh >= sw) return { x: 0, y: 0, w: sw, h: sh };
  const w = Math.round((sh * 3) / 4);
  return { x: Math.round((sw - w) / 2), y: 0, w, h: sh };
}

const SAMPLE_WIDTH = 160;

/** Downscaled pixels of the crop, for brightness checks. */
export function samplePixels(source: CanvasImageSource, crop: Crop, canvas: HTMLCanvasElement): ImageData {
  const w = SAMPLE_WIDTH;
  const h = Math.max(1, Math.round((crop.h / crop.w) * w));
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(source, crop.x, crop.y, crop.w, crop.h, 0, 0, w, h);
  return ctx.getImageData(0, 0, w, h);
}

export function emptyMetrics(crop: Crop): Metrics {
  return {
    faces: 0, faceWidth: 0, inBounds: false, noseX: 0, yaw: 0, roll: 0, pitch: 0,
    jawOpen: 0, smile: 0, blink: 0, luma: 0, balance: 0, lightSide: 0, clipped: 0,
    shortSide: Math.min(crop.w, crop.h), width: crop.w, height: crop.h,
  };
}

export function computeMetrics(
  result: FaceLandmarkerResult,
  sw: number,
  sh: number,
  crop: Crop,
  pixels: ImageData,
): Metrics {
  const shortSide = Math.min(crop.w, crop.h);
  const lm = result.faceLandmarks[0];
  if (!lm) return emptyMetrics(crop);

  // Landmarks are normalised to the source frame; move them into crop space (0–1).
  const P = (i: number) => ({ x: (lm[i].x * sw - crop.x) / crop.w, y: (lm[i].y * sh - crop.y) / crop.h });
  const pts = lm.map((_, i) => P(i));
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const [minX, maxX, minY, maxY] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const faceWidth = maxX - minX;

  const nose = P(1);
  const cheekMid = (P(234).x + P(454).x) / 2;
  const eyeA = P(33);
  const eyeB = P(263);
  let roll = (Math.atan2((eyeB.y - eyeA.y) * crop.h, (eyeB.x - eyeA.x) * crop.w) * 180) / Math.PI;
  if (roll > 90) roll -= 180;
  if (roll < -90) roll += 180;
  const eyesY = (eyeA.y + eyeB.y) / 2;
  const pitch = (nose.y - eyesY) / (P(152).y - eyesY);

  const blend = new Map((result.faceBlendshapes[0]?.categories ?? []).map((c) => [c.categoryName, c.score]));
  const b = (name: string) => blend.get(name) ?? 0;

  // Brightness on the inner face (cheeks, forehead, nose), split at the nose for left/right balance.
  const fh = maxY - minY;
  const box = {
    x0: minX + 0.2 * faceWidth, x1: maxX - 0.2 * faceWidth,
    y0: minY + 0.25 * fh, y1: maxY - 0.1 * fh,
  };
  let sumL = 0, nL = 0, sumR = 0, nR = 0, clipped = 0;
  const { width: pw, height: ph, data } = pixels;
  const x0 = Math.max(0, Math.floor(box.x0 * pw)), x1 = Math.min(pw, Math.ceil(box.x1 * pw));
  const y0 = Math.max(0, Math.floor(box.y0 * ph)), y1 = Math.min(ph, Math.ceil(box.y1 * ph));
  const split = nose.x * pw;
  for (let y = y0; y < y1; y++) {
    for (let x = x0; x < x1; x++) {
      const i = (y * pw + x) * 4;
      const l = 0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2];
      if (l >= 250) clipped++;
      if (x < split) { sumL += l; nL++; } else { sumR += l; nR++; }
    }
  }
  const meanL = nL ? sumL / nL : 0;
  const meanR = nR ? sumR / nR : 0;
  const luma = nL + nR ? (sumL + sumR) / (nL + nR) : 0;

  return {
    faces: result.faceLandmarks.length,
    faceWidth,
    inBounds: minX > 0.01 && maxX < 0.99 && minY > 0.01 && maxY < 0.99,
    noseX: nose.x,
    yaw: (nose.x - cheekMid) / faceWidth,
    roll,
    pitch,
    jawOpen: b("jawOpen"),
    smile: Math.max(b("mouthSmileLeft"), b("mouthSmileRight")),
    blink: Math.max(b("eyeBlinkLeft"), b("eyeBlinkRight")),
    luma,
    balance: luma ? Math.abs(meanL - meanR) / ((meanL + meanR) / 2) : 0,
    lightSide: luma ? (meanL - meanR) / ((meanL + meanR) / 2) : 0,
    clipped: nL + nR ? clipped / (nL + nR) : 0,
    shortSide,
    width: crop.w,
    height: crop.h,
  };
}

const pct = (v: number) => `${Math.round(v * 100)}%`;
const f2 = (v: number) => v.toFixed(2);

export function evaluate(m: Metrics, ref?: Reference | null): Check[] {
  const L = LIMITS;
  if (m.faces !== 1) {
    return [{
      id: "face", label: "One face", pass: false, value: String(m.faces),
      hint: m.faces === 0 ? "No face found" : "Only one face in the frame",
    }];
  }
  const checks: Check[] = [
    {
      id: "size", label: "Face size", value: pct(m.faceWidth),
      pass: m.faceWidth >= L.faceWidth[0] && m.faceWidth <= L.faceWidth[1],
      hint: m.faceWidth < L.faceWidth[0] ? "Move closer" : "Move back",
    },
    { id: "bounds", label: "Whole face in frame", value: m.inBounds ? "yes" : "no", pass: m.inBounds, hint: "Keep forehead and chin inside the frame" },
    {
      id: "centre", label: "Nose on centre line", value: pct(m.noseX - 0.5),
      pass: Math.abs(m.noseX - 0.5) <= L.noseOffset, hint: "Line your nose up with the centre line",
    },
    {
      id: "straight", label: "Facing straight", value: `yaw ${f2(m.yaw)} · roll ${m.roll.toFixed(1)}°`,
      pass: Math.abs(m.yaw) <= L.yaw && Math.abs(m.roll) <= L.roll, hint: "Look straight at the camera, head level",
    },
    {
      id: "tilt", label: "Chin level", value: f2(m.pitch),
      pass: m.pitch >= L.pitch[0] && m.pitch <= L.pitch[1],
      hint: m.pitch < L.pitch[0] ? "Lower your chin a little" : "Raise your chin a little",
    },
    {
      id: "expression", label: "Neutral face", value: `mouth ${f2(m.jawOpen)} · smile ${f2(m.smile)} · blink ${f2(m.blink)}`,
      pass: m.jawOpen <= L.jawOpen && m.smile <= L.smile && m.blink <= L.blink,
      hint: "Relax your face: mouth closed, eyes open, no smile",
    },
    {
      id: "light", label: "Brightness", value: `${Math.round(m.luma)} · glare ${pct(m.clipped)}`,
      pass: m.luma >= L.luma[0] && m.luma <= L.luma[1] && m.clipped <= L.clipped,
      hint: m.luma < L.luma[0] ? "Too dark: face a window or a lamp" : "Too bright or shiny: soften the light",
    },
    {
      id: "even", label: "Even light on both halves", value: pct(m.balance),
      pass: m.balance <= L.balance, hint: "One half is darker: face the light source head-on",
    },
    {
      id: "resolution", label: "Resolution", value: `${m.shortSide}px`,
      pass: m.shortSide >= L.minShortSide, hint: "Use a higher-resolution camera",
    },
  ];
  if (ref) {
    const M = L.match;
    const misses = [
      Math.abs(m.faceWidth - ref.faceWidth) > M.faceWidth && (m.faceWidth < ref.faceWidth ? "closer" : "further back"),
      Math.abs(m.noseX - ref.noseX) > M.noseX && "nose position",
      Math.abs(m.pitch - ref.pitch) > M.pitch && "chin angle",
      Math.abs(m.luma - ref.luma) / ref.luma > M.luma && (m.luma < ref.luma ? "more light" : "less light"),
      ref.lightSide !== undefined && Math.abs(m.lightSide - ref.lightSide) > M.lightSide && "light from another side",
    ].filter(Boolean);
    if (ref.width && ref.height) {
      const same = ref.width === m.width && ref.height === m.height;
      checks.push({
        id: "camera", label: "Same camera as day 0", value: `${m.width}×${m.height}${same ? "" : ` (day 0: ${ref.width}×${ref.height})`}`,
        pass: same, hint: "Use the same camera, phone and mode as day 0",
      });
    }
    checks.push({
      id: "match", label: "Matches day 0", value: misses.length ? `off: ${misses.join(", ")}` : "yes",
      pass: misses.length === 0, hint: "Match day 0: same distance, position, time of day and light",
    });
  }
  return checks;
}

export function referenceFrom(meta: unknown): Reference | null {
  const record = meta as { gate?: { metrics?: Partial<Metrics> }; width?: number; height?: number } | null;
  const m = record?.gate?.metrics;
  if (!m || m.faceWidth === undefined) return null;
  return {
    faceWidth: m.faceWidth, noseX: m.noseX!, pitch: m.pitch!, luma: m.luma!,
    lightSide: m.lightSide,
    width: m.width ?? record?.width, // older camera records kept the size outside the gate
    height: m.height ?? record?.height,
  };
}

export type GateRecord = { passed: boolean; checks: Check[]; metrics: Metrics };

export function gateRecord(checks: Check[], metrics: Metrics): GateRecord {
  return { passed: checks.every((c) => c.pass), checks, metrics };
}

/** Runs the gate on a still image (an uploaded photo): the whole image, no crop. */
export function gateImage(landmarker: FaceLandmarker, img: ImageBitmap, ref: Reference | null, canvas: HTMLCanvasElement) {
  const crop = { x: 0, y: 0, w: img.width, h: img.height };
  const metrics = computeMetrics(landmarker.detect(img), img.width, img.height, crop, samplePixels(img, crop, canvas));
  return gateRecord(evaluate(metrics, ref), metrics);
}
