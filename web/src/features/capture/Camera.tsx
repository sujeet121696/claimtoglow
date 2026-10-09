// Live camera with the capture gate: the shutter only works while every check passes. Auto mode
// beeps a 2-second countdown and shoots by itself, so a phone on a stand works
// hands-free. "Fresh shots" makes you leave the frame between shots, which the noise test needs.
// Self-contained: give it a set name and the treated side, and it saves gated photos there.
import { useEffect, useRef, useState } from "react";
import type { FaceLandmarker } from "@mediapipe/tasks-vision";
import { api } from "../../api/client";
import type { Side } from "../../api/types";
import { ChecksList } from "../../components/ChecksList";
import { Card } from "../../components/ui";
import { useReference } from "../../hooks/useReference";
import { beep } from "../../lib/beep";
import { loadPref, savePref } from "../../lib/storage";
import { computeMetrics, evaluate, gateRecord, LIMITS, portraitCrop, requiredPass, samplePixels, type Check, type Crop, type Metrics } from "../../lib/gate";
import { getLandmarker } from "../../lib/landmarker";
import { saveMaskFor } from "../../lib/maskBackfill";

const HOLD_MS = 2000;
const DETECT_EVERY_MS = 100;
// Landmarks jitter: a check must fail this long before the countdown restarts. The photo is still
// taken only on a frame where every check passes.
const GRACE_MS = 400;

// Short names for the check chips on the video.
const CHIP: Record<string, string> = {
  face: "Face", size: "Size", bounds: "In frame", centre: "Centre", straight: "Straight", tilt: "Chin",
  expression: "Neutral", light: "Light", even: "Even light", resolution: "Sharp", camera: "Camera", match: "Day 0",
};

// stepOut: start with "Step out between shots" on (repeat photos and checkpoint days).
// done: today's check-in photos are all saved, so auto-capture stops.
type Props = { setName: string; side: Side; title?: string; stepOut?: boolean; done?: boolean; onSaved: () => void };

export function Camera({ setName, side, title, stepOut = false, done = false, onSaved }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewRef = useRef<HTMLCanvasElement>(null);
  const sampleCanvas = useRef(document.createElement("canvas"));
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [running, setRunning] = useState(false);
  const [checks, setChecks] = useState<Check[]>([]);
  const [reference, reloadReference] = useReference(setName);
  // Hands-free by default on phones (touch screens), where the phone sits on a stand.
  const [auto, setAuto] = useState(() => window.matchMedia("(pointer: coarse)").matches);
  const [fresh, setFresh] = useState(stepOut);
  const [ghost, setGhost] = useState(true);
  const [steady, setSteady] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [leaving, setLeaving] = useState(false); // waiting for the person to step out of frame
  const [justSaved, setJustSaved] = useState(""); // brief confirmation on the video

  // Mutable state read by the animation loop.
  const live = useRef({
    metrics: null as Metrics | null, checks: [] as Check[], crop: null as Crop | null,
    lastDetect: 0, passSince: 0, failSince: 0, noFaceSince: 0, awaitingLeave: false, capturing: false,
    lastBeep: -1, mirror: true, deviceLabel: "",
  });
  const opts = useRef({ auto, fresh, ghost, reference, side, setName, done, onSaved });
  opts.current = { auto, fresh, ghost, reference, side, setName, done, onSaved };

  function stop() {
    const v = videoRef.current;
    (v?.srcObject as MediaStream | null)?.getTracks().forEach((t) => t.stop());
    if (v) v.srcObject = null;
    setRunning(false);
  }

  /** The camera to use: the one day 0 was taken with, else the last one used here, else the selfie camera. */
  async function preferredDevice(): Promise<string | undefined> {
    const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput" && d.deviceId);
    const sameAsDay0 = reference.device ? cams.find((d) => d.label === reference.device) : undefined;
    const last = cams.find((d) => d.deviceId === loadPref("cameraId"));
    return (sameAsDay0 ?? last)?.deviceId;
  }

  // Each start gets a number; a start overtaken by a newer one (auto-start plus a tap, or a camera
  // switch) steps aside instead of reporting "play() was interrupted" as a failure.
  const startSeq = useRef(0);

  async function start(id?: string) {
    const seq = ++startSeq.current;
    const stale = () => seq !== startSeq.current;
    stop();
    setError("");
    try {
      const deviceId = id ?? (await preferredDevice());
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          ...(deviceId ? { deviceId: { exact: deviceId } } : { facingMode: "user" }),
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
      });
      if (stale()) { stream.getTracks().forEach((t) => t.stop()); return; }
      const v = videoRef.current!;
      v.srcObject = stream;
      await v.play();
      if (stale()) return;
      const track = stream.getVideoTracks()[0];
      const settings = track.getSettings();
      live.current.mirror = settings.facingMode !== "environment"; // selfie preview mirrors; saved photos never do
      live.current.deviceLabel = track.label;
      setDeviceId(settings.deviceId ?? "");
      if (settings.deviceId) savePref("cameraId", settings.deviceId);
      setDevices((await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput"));
      await getLandmarker("VIDEO");
      setRunning(true);
    } catch (e) {
      if (stale()) return;
      const blocked = (e as Error).name === "NotAllowedError" || !window.isSecureContext;
      setError(`Camera failed: ${(e as Error).message}.${blocked ? " Allow camera access, and on a phone open the https:// address." : " Tap Start camera again."}`);
    }
  }

  useEffect(() => stop, []);

  // Start by itself once camera access was granted before, after day 0 is known (to pick its camera).
  const autoStarted = useRef(false);
  useEffect(() => {
    if (autoStarted.current || !reference.loaded) return;
    autoStarted.current = true;
    navigator.permissions?.query({ name: "camera" as PermissionName })
      .then((p) => { if (p.state === "granted") void start(); })
      .catch(() => { /* permissions API unavailable: wait for the Start button */ });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reference.loaded]);

  // Keep the screen on while the camera is open, so a phone on a stand doesn't dim mid-countdown.
  useEffect(() => {
    if (!running || !("wakeLock" in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    navigator.wakeLock.request("screen").then((l) => (lock = l)).catch(() => {});
    return () => { void lock?.release(); };
  }, [running]);

  // On a phone the live camera takes the whole screen, so nothing scrolls while posing.
  useEffect(() => {
    if (!running || !window.matchMedia("(max-width: 860px)").matches) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [running]);

  useEffect(() => {
    if (!running) return;
    let raf = 0;
    let landmarker: FaceLandmarker | null = null;
    getLandmarker("VIDEO").then((l) => (landmarker = l));

    const tick = () => {
      raf = requestAnimationFrame(tick);
      const v = videoRef.current;
      const view = viewRef.current;
      if (!v || !view || v.readyState < 2 || !landmarker || !v.videoWidth) return;
      const L = live.current;
      const sw = v.videoWidth;
      const sh = v.videoHeight;
      const crop = portraitCrop(sw, sh);
      L.crop = crop;
      const now = performance.now();
      if (now - L.lastDetect >= DETECT_EVERY_MS) {
        L.lastDetect = now;
        const result = landmarker.detectForVideo(v, now);
        L.metrics = computeMetrics(result, sw, sh, crop, samplePixels(v, crop, sampleCanvas.current));
        L.checks = evaluate(L.metrics, opts.current.reference.ref);
        setChecks(L.checks);
        step(now);
      }
      draw(view, v, crop);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  function step(now: number) {
    const L = live.current;
    const reset = () => {
      L.passSince = 0;
      L.failSince = 0;
      L.lastBeep = -1;
      setSteady(false);
    };
    if (L.awaitingLeave) {
      if (L.metrics?.faces === 0) {
        L.noFaceSince ||= now;
        if (now - L.noFaceSince > 800) {
          L.awaitingLeave = false;
          setLeaving(false);
          setStatus((s) => s.replace(/ · step out.*$/, "") + " · ready for the next shot");
        }
      } else {
        L.noFaceSince = 0;
      }
      return reset();
    }
    const pass = requiredPass(L.checks);
    if (L.capturing) return reset();
    if (!pass) {
      if (!L.passSince) return;
      L.failSince ||= now;
      if (now - L.failSince > GRACE_MS) reset();
      return; // never shoot on a failing frame
    }
    L.failSince = 0;
    L.passSince ||= now;
    const held = now - L.passSince;
    setSteady(held >= 500);
    if (!opts.current.auto || opts.current.done) return;
    const left = Math.ceil((HOLD_MS - held) / 1000);
    if (left <= 0) {
      void capture();
    } else if (left !== L.lastBeep) {
      L.lastBeep = left;
      beep(440);
    }
  }

  function draw(view: HTMLCanvasElement, v: HTMLVideoElement, crop: Crop) {
    const L = live.current;
    const o = opts.current;
    const dw = Math.min(crop.w, 720);
    const dh = Math.round((dw * crop.h) / crop.w);
    if (view.width !== dw || view.height !== dh) {
      view.width = dw;
      view.height = dh;
    }
    const ctx = view.getContext("2d")!;
    ctx.save();
    if (L.mirror) {
      ctx.translate(dw, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(v, crop.x, crop.y, crop.w, crop.h, 0, 0, dw, dh);
    if (o.ghost && o.reference.img) {
      ctx.globalAlpha = 0.35;
      drawCover(ctx, o.reference.img, dw, dh);
      ctx.globalAlpha = 1;
    }
    ctx.restore();

    // Guides are symmetric, so mirroring doesn't move them.
    const ok = requiredPass(L.checks);
    ctx.lineWidth = 2;
    ctx.strokeStyle = ok ? "#00c853" : "#ffb020"; // brand green when every check passes
    line(ctx, dw / 2, 0, dw / 2, dh);
    ctx.setLineDash([6, 6]);
    ctx.strokeStyle = "rgba(255,255,255,0.7)";
    for (const w of LIMITS.faceWidth) {
      const x = ((1 - w) / 2) * dw;
      line(ctx, x, dh * 0.15, x, dh * 0.85);
      line(ctx, dw - x, dh * 0.15, dw - x, dh * 0.85);
    }
    ctx.setLineDash([]);

    // T / C labels: the treated side is fixed in image space, so it flips with the mirrored preview.
    const treatedOnLeft = (o.side === "L") !== L.mirror;
    ctx.font = "bold 22px system-ui, sans-serif";
    ctx.fillStyle = "rgba(0,0,0,0.55)";
    ctx.fillRect(8, 8, 34, 32);
    ctx.fillRect(dw - 42, 8, 34, 32);
    ctx.fillStyle = "#fff";
    ctx.fillText(treatedOnLeft ? "T" : "C", 17, 32);
    ctx.fillText(treatedOnLeft ? "C" : "T", dw - 33, 32);

    if (L.passSince && o.auto && !o.done && !L.capturing) {
      const left = Math.max(1, Math.ceil((HOLD_MS - (performance.now() - L.passSince)) / 1000));
      ctx.font = "bold 96px system-ui, sans-serif";
      ctx.textAlign = "center";
      ctx.fillStyle = "rgba(255,255,255,0.85)";
      ctx.fillText(String(left), dw / 2, dh / 2);
      ctx.textAlign = "start";
    }
  }

  async function capture(force = false) {
    const L = live.current;
    const o = opts.current;
    const v = videoRef.current;
    if (!v || !L.crop || !L.metrics || L.capturing) return;
    // "Capture anyway" may skip failed checks, but never the fresh-shot rule: near-identical
    // frames would make the noise floor look smaller than it is.
    if (L.awaitingLeave) return setStatus("Step out of frame and come back before the next shot.");
    L.capturing = true;
    try {
      const { crop } = L;
      const canvas = document.createElement("canvas");
      canvas.width = crop.w;
      canvas.height = crop.h;
      canvas.getContext("2d")!.drawImage(v, crop.x, crop.y, crop.w, crop.h, 0, 0, crop.w, crop.h);
      const gate = gateRecord(L.checks, L.metrics);
      if (!gate.passed && !force) return;
      const blob = await new Promise<Blob>((res, rej) =>
        canvas.toBlob((b) => (b ? res(b) : rej(new Error("JPEG encode failed"))), "image/jpeg", 0.95),
      );
      const photo = await api.upload(o.setName, blob, "capture.jpg", {
        source: "camera", treated_side: o.side, gate, device: L.deviceLabel, width: crop.w, height: crop.h,
      });
      beep(880, 0.3);
      saveMaskFor(o.setName, photo.stem, canvas).catch(() => undefined); // the lab PC fills any gap later
      let msg = `Saved ${o.setName}/${photo.stem}${gate.passed ? "" : " (gate failed, marked)"}`;
      if (o.fresh) {
        L.awaitingLeave = true;
        L.noFaceSince = 0;
        setLeaving(true);
        msg += " · step out of frame, then come back";
      }
      setStatus(msg);
      setJustSaved(`Saved ${photo.stem} ✓`);
      setTimeout(() => setJustSaved(""), 2000);
      if (photo.stem === "day-00") reloadReference();
      o.onSaved();
    } catch (e) {
      setStatus(`Save failed: ${(e as Error).message}`);
    } finally {
      L.capturing = false;
      L.passSince = 0;
    }
  }

  // The one thing to do next, shown large on the video.
  const failing = checks.find((c) => !c.pass && !c.optional);
  const hint = justSaved
    ? { text: justSaved, tone: "good" }
    : done
      ? { text: "Today's photos are all saved ✓", tone: "good" }
    : leaving
      ? { text: checks[0]?.id === "face" ? "Now come back into the frame" : "Step out of the frame", tone: "info" }
      : !checks.length ? { text: "Looking for your face…", tone: "info" }
      : failing ? { text: failing.hint, tone: "bad" }
      : { text: auto ? "Hold still…" : steady ? "Looks good: tap the shutter" : "Hold still…", tone: "good" };

  return (
    <div className={`capture ${running ? "live" : ""}`}>
      <div className="stage">
        <video ref={videoRef} playsInline muted className="hidden-video" />
        <canvas ref={viewRef} className="view" />
        {!running && (
          <div className="stage-empty">
            <button className="primary" onClick={() => start()}>Start camera</button>
            <p className="small">Use the same camera, spot and light every day.</p>
            {error && <p className="error">{error}</p>}
          </div>
        )}

        {running && (
          <>
            <div className="ov-top">
              <span>{title}</span>
              <button className="ov-close" aria-label="Close camera" onClick={stop}>✕</button>
            </div>

            <div className={`ov-hint ${hint.tone}`} role="status">{hint.text}</div>

            <div className="ov-bottom">
              <div className="chips">
                {checks.map((c) => (
                  <span key={c.id} className={`chip ${c.pass ? "pass" : c.optional ? "warn" : "fail"}`}>{c.pass ? "✓" : c.optional ? "!" : "✗"} {CHIP[c.id] ?? c.label}</span>
                ))}
              </div>
              <div className="ov-controls">
                <button className={`ov-toggle ${auto ? "on" : ""}`} aria-pressed={auto} onClick={() => setAuto(!auto)}>Auto</button>
                <button className="shutter-btn" aria-label="Capture" disabled={!steady || leaving} onClick={() => capture()} />
                <button className={`ov-toggle ${fresh ? "on" : ""}`} aria-pressed={fresh} onClick={() => setFresh(!fresh)}>Step out</button>
              </div>
              <button className="ov-anyway" disabled={leaving} onClick={() => capture(true)}>Capture anyway</button>
            </div>
          </>
        )}
      </div>

      <div className="capture-side">
        <Card title="Checks">
          <ChecksList checks={running ? checks : []} empty={running ? "Waiting for a face…" : "Start the camera to see the checks."} />
          <div className="shutter">
            <button className="primary" disabled={!running || !steady} onClick={() => capture()}>
              {steady ? "Capture" : "Hold still…"}
            </button>
            <button className="ghost" disabled={!running} onClick={() => capture(true)} title="Saves even if checks fail; the photo is marked as failing the gate">
              Capture anyway
            </button>
          </div>
          {status && <p className="status" role="status">{status}</p>}
        </Card>

        <Card title="Options">
          {devices.length > 1 && (
            <label className="option">
              <span>Camera</span>
              <select value={deviceId} onChange={(e) => start(e.target.value)}>
                {devices.map((d, i) => <option key={d.deviceId} value={d.deviceId}>{d.label || `Camera ${i + 1}`}</option>)}
              </select>
            </label>
          )}
          <label className="option"><input type="checkbox" checked={auto} onChange={(e) => setAuto(e.target.checked)} /> Auto-capture with countdown</label>
          <label className="option"><input type="checkbox" checked={fresh} onChange={(e) => setFresh(e.target.checked)} /> Step out of frame between shots</label>
          <label className="option"><input type="checkbox" checked={ghost} onChange={(e) => setGhost(e.target.checked)} disabled={!reference.img} /> Show day-0 ghost</label>
          {!reference.ref && <p className="muted small">No day-0 photo yet: the first daily check-in becomes day 0, the reference for every later photo.</p>}
        </Card>
      </div>
    </div>
  );
}

function line(ctx: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number) {
  ctx.beginPath();
  ctx.moveTo(x0, y0);
  ctx.lineTo(x1, y1);
  ctx.stroke();
}

function drawCover(ctx: CanvasRenderingContext2D, img: HTMLImageElement, w: number, h: number) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const iw = img.naturalWidth * s;
  const ih = img.naturalHeight * s;
  ctx.drawImage(img, (w - iw) / 2, (h - ih) / 2, iw, ih);
}
