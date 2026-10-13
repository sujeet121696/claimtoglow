// One command to check, build and run the lab on this PC: npm run local (add -- --tunnel, or use
// npm run local:tunnel, to open it from anywhere too). Steps stop at the first failure.
//   1. setup:  .venv, Python packages and web/node_modules when missing
//   2. clean:  web/dist, web/dist-demo and __pycache__ folders (photos, results and lab.db untouched)
//   3. check:  Python unit tests and the TypeScript type-check
//   4. build:  the lab app (web/dist) and the judge demo (web/dist-demo)
//   5. run:    the API on :8000, which serves both; with --tunnel, cloudflared as well
import { spawn, spawnSync } from "node:child_process";
import { existsSync, readdirSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "..");
const WEB = join(ROOT, "web");
const WIN = process.platform === "win32";
const PY = join(ROOT, ".venv", WIN ? "Scripts/python.exe" : "bin/python");
const TUNNEL_CONFIG = join(homedir(), ".cloudflared", "claimtoglow.yml");
const tunnel = process.argv.includes("--tunnel");

function step(title) {
  console.log(`\n▶ ${title}`);
}

function run(cmd, args, cwd = ROOT) {
  const r = spawnSync(cmd, args, { cwd, stdio: "inherit", shell: WIN && cmd === "npm" });
  if (r.status !== 0) {
    console.error(`\n✖ Failed: ${cmd} ${args.join(" ")}`);
    process.exit(r.status ?? 1);
  }
}

function removePycache(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name === ".venv" || entry.name === "node_modules") continue;
    const path = join(dir, entry.name);
    if (entry.name === "__pycache__") rmSync(path, { recursive: true, force: true });
    else removePycache(path);
  }
}

step("Setup");
if (!existsSync(join(ROOT, ".env"))) console.warn("  ! No .env: copy .env.example and add the YouCam keys.");
if (!existsSync(PY)) run(WIN ? "python" : "python3", ["-m", "venv", ".venv"]);
run(PY, ["-m", "pip", "install", "-q", "-r", "requirements.txt"]);
if (!existsSync(join(WEB, "node_modules"))) run("npm", ["install"], WEB);

step("Clean");
for (const dir of ["dist", "dist-demo"]) rmSync(join(WEB, dir), { recursive: true, force: true });
for (const dir of ["app", "scripts", "tests"]) removePycache(join(ROOT, dir));

step("Check: unit tests");
run(PY, ["-m", "unittest", "discover", "-s", "tests"]);
step("Check: type-check");
run("npm", ["run", "typecheck"], WEB);

step("Build: lab app and judge demo");
run("npm", ["exec", "--", "vite", "build"], WEB);
run("npm", ["exec", "--", "vite", "build", "--mode", "demo", "--outDir", "dist-demo", "--base", "./"], WEB);

step(`Run: http://localhost:8000 (demo at /demo/)${tunnel ? " + Cloudflare tunnel" : ""}. Ctrl+C stops.`);
const children = [spawn(PY, ["-m", "uvicorn", "app.main:app", "--port", "8000"], { cwd: ROOT, stdio: "inherit" })];
if (tunnel) {
  if (!existsSync(TUNNEL_CONFIG)) console.warn(`  ! ${TUNNEL_CONFIG} not found (README: Open it from anywhere).`);
  children.push(spawn("cloudflared", ["--config", TUNNEL_CONFIG, "tunnel", "run"], { cwd: ROOT, stdio: "inherit" }));
}

// When one process ends (or Ctrl+C), stop the other, so nothing is left running in the background.
let stopping = false;
function stopAll(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const c of children) if (c.exitCode === null) c.kill();
  process.exitCode = code;
}
for (const c of children) {
  c.on("exit", (code) => stopAll(code ?? 0));
  c.on("error", (err) => { console.error(`\n✖ ${err.message}`); stopAll(1); });
}
process.on("SIGINT", () => stopAll(0));
