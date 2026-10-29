// Lanza Vite y Electron juntos para desarrollo de escritorio.
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { join } from "node:path";

const require = createRequire(import.meta.url);
const electronPath = require("electron");
const isWindows = process.platform === "win32";
const port = Number(process.env.ELECTRON_DEV_PORT || 5173);
const url = `http://localhost:${port}/`;

const npmCommand = isWindows ? "npm.cmd" : "npm";
const dev = spawn(npmCommand, ["run", "dev", "--", "--port", String(port), "--strictPort"], {
  stdio: "inherit",
  shell: isWindows,
  env: process.env,
});

let electron = null;
let stopping = false;

const stop = (code = 0) => {
  if (stopping) return;
  stopping = true;
  try {
    electron?.kill();
  } catch {
    /* ignorado */
  }
  if (isWindows && dev.pid) {
    spawn("taskkill", ["/pid", String(dev.pid), "/T", "/F"], { stdio: "ignore" });
  } else {
    dev.kill();
  }
  process.exit(code);
};

const waitForServer = async () => {
  for (let attempt = 0; attempt < 120; attempt++) {
    try {
      const response = await fetch(url);
      if (response.ok) return true;
    } catch {
      /* todavía no levantó */
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
};

dev.on("exit", (code) => {
  if (!stopping) stop(code ?? 1);
});

const ready = await waitForServer();
if (!ready) {
  console.error(`No se pudo iniciar Vite en ${url}`);
  stop(1);
}

console.log(`Atril escritorio: ${url}`);
electron = spawn(electronPath, [join(process.cwd(), "electron", "main.cjs")], {
  stdio: "inherit",
  env: { ...process.env, ELECTRON_START_URL: url },
});

electron.on("exit", (code) => stop(code ?? 0));
process.on("SIGINT", () => stop(0));
process.on("SIGTERM", () => stop(0));
