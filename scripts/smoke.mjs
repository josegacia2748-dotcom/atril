// Smoke test de Atril con Edge headless + CDP. Sin dependencias externas.
// Uso: node scripts/smoke.mjs [url]
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const URL = process.argv[2] ?? "http://localhost:4180/";
const EDGE_CANDIDATES = [
  "C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe",
  "C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe",
];
const edge = EDGE_CANDIDATES.find((path) => existsSync(path));
if (!edge) throw new Error("No se encontro Edge");

const port = 9334;
const profile = mkdtempSync(join(tmpdir(), "atril-cdp-"));
const outDir = join(process.cwd(), ".preview");
mkdirSync(outDir, { recursive: true });

const proc = spawn(
  edge,
  [
    "--headless=new",
    "--disable-gpu",
    "--hide-scrollbars",
    "--no-first-run",
    "--no-default-browser-check",
    "--autoplay-policy=no-user-gesture-required",
    "--mute-audio",
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    "--window-size=1440,900",
    "about:blank",
  ],
  { stdio: "ignore" },
);

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const results = [];
const errors = [];
let ws;
let seq = 0;
const pending = new Map();

const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++seq;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

const evalJs = async (expression) => {
  const reply = await send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (reply.exceptionDetails) {
    throw new Error(`Eval fallo: ${reply.exceptionDetails.text} ${reply.exceptionDetails.exception?.description ?? ""}`);
  }
  return reply.result.value;
};

const dispatchClick = async (point) => {
  await send("Input.dispatchMouseEvent", { type: "mouseMoved", x: point.x, y: point.y });
  await send("Input.dispatchMouseEvent", { type: "mousePressed", x: point.x, y: point.y, button: "left", clickCount: 1 });
  await send("Input.dispatchMouseEvent", { type: "mouseReleased", x: point.x, y: point.y, button: "left", clickCount: 1 });
};

const click = async (selector, index = 0) => {
  const point = await evalJs(`(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    const el = document.querySelectorAll(${JSON.stringify(selector)})[${index}];
    if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (!point) throw new Error(`No existe ${selector}[${index}]`);
  await dispatchClick(point);
};

const clickText = async (selector, text) => {
  const point = await evalJs(`(() => {
    document.documentElement.style.scrollBehavior = 'auto';
    const el = [...document.querySelectorAll(${JSON.stringify(selector)})].find((node) => node.textContent.includes(${JSON.stringify(text)}));
    if (!el) return null;
    el.scrollIntoView({ block: 'center', inline: 'center' });
    const r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  })()`);
  if (!point) throw new Error(`No existe ${selector} con texto ${text}`);
  await dispatchClick(point);
};

const waitFor = async (expression, label, timeout = 25000) => {
  const start = Date.now();
  let last;
  while (Date.now() - start < timeout) {
    try {
      last = await evalJs(expression);
      if (last) return last;
    } catch {
      /* la pagina puede estar navegando */
    }
    await wait(250);
  }
  throw new Error(`Timeout esperando: ${label} (${expression})`);
};

const shot = async (name) => {
  const data = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(outDir, name), Buffer.from(data.data, "base64"));
};

const check = (name, ok, detail = "") => {
  results.push({ name, ok, detail });
  console.log(`${ok ? "PASS" : "FAIL"} ${name}${detail ? ` - ${detail}` : ""}`);
};

try {
  let target = null;
  for (let attempt = 0; attempt < 60 && !target; attempt++) {
    try {
      const response = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await response.json();
      target = list.find((item) => item.type === "page");
    } catch {
      await wait(200);
    }
  }
  if (!target) throw new Error("CDP no respondio");

  ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.onopen = resolve;
    ws.onerror = reject;
  });
  ws.onmessage = (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve(message.result);
      return;
    }
    if (message.method === "Runtime.exceptionThrown") {
      const details = message.params.exceptionDetails;
      errors.push(details.exception?.description ?? details.text);
    }
    if (message.method === "Log.entryAdded" && message.params.entry.level === "error") {
      errors.push(message.params.entry.text);
    }
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
      errors.push(message.params.args.map((arg) => arg.value ?? arg.description ?? "").join(" "));
    }
  };

  await send("Page.enable");
  await send("Runtime.enable");
  await send("Log.enable");
  await send("Network.enable");
  await send("Emulation.setDeviceMetricsOverride", {
    width: 1440,
    height: 900,
    deviceScaleFactor: 1,
    mobile: false,
  });

  await send("Page.navigate", { url: URL });
  await wait(1600);

  const login = await evalJs(`({
    title: document.title,
    heading: document.querySelector('.login-hero h1')?.textContent ?? null,
    profiles: document.querySelectorAll('.profile-option').length,
    tabs: document.querySelectorAll('.access-tabs button').length,
    overflowX: document.documentElement.scrollWidth > window.innerWidth,
    stored: Boolean(localStorage.getItem('atril:v1')),
  })`);
  check("Login renderiza con perfiles demo", login.profiles >= 1 && login.tabs === 2, JSON.stringify(login));
  check("Login sin desbordamiento horizontal", !login.overflowX);
  await shot("01-login.png");

  // Entrar como directora
  await click(".profile-option", 0);
  await waitFor("Boolean(document.querySelector('.page-head h1'))", "panel del director");
  const director = await evalJs(`({
    heading: document.querySelector('.page-head h1')?.textContent ?? null,
    stats: document.querySelectorAll('.stat').length,
    recent: document.querySelectorAll('.score-card').length,
    sidebar: Boolean(document.querySelector('.sidebar')),
    theme: document.documentElement.dataset.theme,
    orchestra: document.querySelector('.sidebar .card')?.textContent ?? null,
  })`);
  check("Panel del director con estadisticas", director.stats >= 4 && director.recent >= 3 && director.sidebar, JSON.stringify(director));
  check("Tema oscuro por defecto", director.theme === "dark", director.theme);
  await shot("02-director.png");

  // Tema claro y vuelta al oscuro
  await click('.topbar button[aria-label="Cambiar tema"]');
  await wait(300);
  const light = await evalJs("document.documentElement.dataset.theme");
  await click('.topbar button[aria-label="Cambiar tema"]');
  await wait(300);
  const dark = await evalJs("document.documentElement.dataset.theme");
  check("Tema claro/oscuro alterna", light === "light" && dark === "dark", `${light} -> ${dark}`);

  // Ir a subir y generar el PDF de ejemplo
  await clickText(".nav-item", "Subir partitura");
  await waitFor("Boolean(document.querySelector('.dropzone'))", "zona de carga");
  await clickText(".dropzone .btn", "Generar ejemplo OMR");
  await waitFor("document.querySelector('.file-chip') && !document.querySelector('.progress')", "fin del analisis OMR", 40000);
  const omr = await evalJs(`(() => {
    const stats = [...document.querySelectorAll('.card .stat')].map((node) => ({ value: node.querySelector('b')?.textContent, label: node.querySelector('span')?.textContent }));
    return {
      step: document.querySelector('.step-pill.active')?.textContent?.trim() ?? null,
      stats,
      warnings: [...document.querySelectorAll('.warning-list li')].map((node) => node.textContent),
      clef: document.querySelector('#upload-clef')?.value ?? null,
      file: document.querySelector('.file-chip')?.textContent ?? null,
    };
  })()`);
  const noteStat = omr.stats.find((item) => item.label === "Notas detectadas");
  const notes = Number(noteStat?.value ?? 0);
  check("OMR detecta notas en el PDF sintetico", notes >= 8, JSON.stringify(omr));
  check("OMR mantiene clave de sol de respaldo", omr.clef === "treble", omr.clef);
  await shot("03-omr.png");

  // Continuar a metadatos
  await clickText(".btn", "Continuar a metadatos");
  await waitFor("Boolean(document.querySelector('#upload-title'))", "paso de metadatos");
  const titleValue = await evalJs("document.querySelector('#upload-title')?.value");
  check("Titulo precargado desde el PDF", String(titleValue).includes("Ejemplo para OMR"), String(titleValue));

  // Asignar instrumentos
  for (const instrument of ["Violín", "Flauta traversa", "Clarinete en Si♭", "Piano"]) {
    await clickText(".instrument-option", instrument);
    await wait(120);
  }
  const selected = await evalJs(`({
    count: document.querySelectorAll('.instrument-option.selected').length,
    names: [...document.querySelectorAll('.instrument-option.selected')].map((node) => node.textContent.trim().split('\\n')[0]),
  })`);
  check("Asignacion multiple por instrumento", selected.count === 4, JSON.stringify(selected));

  // Vista previa OSMD
  await clickText(".btn", "Actualizar vista previa");
  await waitFor("Boolean(document.querySelector('.osmd-host svg') || document.querySelector('.osmd-error'))", "render OSMD", 30000);
  const osmd = await evalJs(`({
    svg: document.querySelectorAll('.osmd-host svg').length,
    error: document.querySelector('.osmd-error')?.textContent ?? null,
    height: document.querySelector('.osmd-host')?.getBoundingClientRect().height ?? 0,
  })`);
  check("OpenSheetMusicDisplay dibuja la notacion", osmd.svg > 0 && !osmd.error && osmd.height > 100, JSON.stringify(osmd));
  await shot("04-upload-preview.png");

  // Guardar
  await clickText(".btn", "Guardar partitura");
  await waitFor("location.hash.startsWith('#/partitura/')", "navegacion a la partitura", 20000);
  await waitFor("Boolean(document.querySelector('.score-hero h1'))", "hero de la partitura");
  const saved = await evalJs(`(() => {
    const state = JSON.parse(localStorage.getItem('atril:v1'));
    const score = state.scores[0];
    return {
      title: document.querySelector('.score-hero h1')?.textContent ?? null,
      hash: location.hash,
      tabs: document.querySelectorAll('.tab').length,
      score: score ? { title: score.title, events: score.events.length, instruments: score.instrumentIds, omr: score.omr, pdfId: score.pdfId } : null,
    };
  })()`);
  check(
    "Partitura guardada con eventos, OMR y PDF",
    saved.score && saved.score.events >= 8 && saved.score.omr && saved.score.pdfId && saved.score.instruments.length === 4,
    JSON.stringify(saved.score),
  );
  await waitFor("Boolean(document.querySelector('.osmd-host svg'))", "notacion de la partitura guardada", 30000);
  await shot("05-score.png");

  // PDF original
  await clickText(".tab", "PDF original");
  await waitFor("document.querySelector('.viewer-body canvas')?.width > 500", "render del PDF");
  await wait(500);
  const pdfView = await evalJs(`({
    width: document.querySelector('.viewer-body canvas')?.width ?? 0,
    height: document.querySelector('.viewer-body canvas')?.height ?? 0,
    page: document.querySelector('.viewer-toolbar .mono')?.textContent ?? null,
    canvasCount: document.querySelectorAll('.viewer-body canvas').length,
    error: document.querySelector('.callout.warn')?.textContent ?? null,
  })`);
  check("Visor de PDF rasteriza la pagina", pdfView.width > 500 && pdfView.canvasCount === 1 && !pdfView.error, JSON.stringify(pdfView));
  await shot("06-pdf.png");

  // Audio
  await clickText(".tab", "Audio");
  await waitFor("Boolean(document.querySelector('.player'))", "reproductor");
  await waitFor("document.querySelector('.play-btn') && !document.querySelector('.play-btn').disabled", "audio listo", 20000);
  await click(".play-btn");
  await wait(2200);
  const audio = await evalJs(`({
    times: [...document.querySelectorAll('.timeline .times span')].map((node) => node.textContent),
    error: document.querySelector('.callout.warn')?.textContent ?? null,
    notes: document.querySelector('.track-sub')?.textContent ?? null,
  })`);
  check("Reproductor avanza con Tone.js", audio.times[0] !== "0:00", JSON.stringify(audio));
  await shot("07-audio.png");

  // Cambiar asignaciones: quitar Piano
  await clickText(".tab", "Partitura");
  await clickText(".instrument-option", "Piano");
  await clickText(".btn", "Guardar asignaciones");
  await wait(500);
  const assignments = await evalJs(`(() => {
    const state = JSON.parse(localStorage.getItem('atril:v1'));
    const score = state.scores.find((item) => location.hash.endsWith(item.id));
    return { instruments: score?.instrumentIds ?? [], saved: document.body.textContent.includes('Asignaciones actualizadas') };
  })()`);
  check("Asignaciones se guardan sin Piano", !assignments.instruments.includes("piano") && assignments.instruments.includes("violin"), JSON.stringify(assignments));

  // Cerrar sesion y entrar como musico de violin
  await click('.sidebar-footer button[aria-label="Cerrar sesión"]');
  await waitFor("Boolean(document.querySelector('.login'))", "login tras cerrar sesion");
  await clickText(".access-tabs button", "Músico");
  await wait(300);
  await clickText(".profile-option", "Carlos Mendoza");
  await waitFor("Boolean(document.querySelector('.hero-panel h1'))", "panel del musico");
  const musician = await evalJs(`({
    heading: document.querySelector('.hero-panel h1')?.textContent ?? null,
    cards: document.querySelectorAll('.score-card').length,
    stats: [...document.querySelectorAll('.stat b')].map((node) => node.textContent),
    nav: [...document.querySelectorAll('.nav-item')].map((node) => node.textContent.trim()),
    instrument: document.querySelector('.sidebar .card')?.textContent ?? null,
  })`);
  check("Musico ve solo su material asignado", musician.cards >= 1 && musician.heading.includes("Hola"), JSON.stringify(musician));
  check("Navegacion de musico sin biblioteca", !musician.nav.some((item) => item.includes("Biblioteca")), JSON.stringify(musician.nav));
  await shot("08-musician.png");

  // Abrir la partitura como musico
  await click(".score-card", 0);
  await waitFor("Boolean(document.querySelector('.score-hero h1'))", "partitura del musico");
  const access = await evalJs(`({
    title: document.querySelector('.score-hero h1')?.textContent ?? null,
    instrumentSelect: Boolean(document.querySelector('#score-instrument')),
    note: [...document.querySelectorAll('.small.muted')].map((node) => node.textContent).find((text) => text.includes('Parte escrita') || text.includes('no es transpositor')) ?? null,
    tabs: document.querySelectorAll('.tab').length,
  })`);
  check("Musico accede a su parte sin selector de instrumento", access.tabs === 3 && !access.instrumentSelect, JSON.stringify(access));

  // Movil
  await send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await send("Page.navigate", { url: `${URL.replace(/\/$/, "")}/#/` });
  await wait(1600);
  const mobile = await evalJs(`({
    overflowX: document.documentElement.scrollWidth > window.innerWidth + 1,
    menuVisible: getComputedStyle(document.querySelector('.menu-btn')).display !== 'none',
    sidebarOpen: Boolean(document.querySelector('.sidebar.open')),
    cards: document.querySelectorAll('.score-card').length,
    width: window.innerWidth,
  })`);
  check("Vista movil sin desbordamiento y menu disponible", !mobile.overflowX && mobile.menuVisible, JSON.stringify(mobile));
  await shot("09-mobile.png");
  await click(".menu-btn");
  await wait(400);
  const drawer = await evalJs(`({
    open: Boolean(document.querySelector('.sidebar.open')),
    transform: getComputedStyle(document.querySelector('.sidebar')).transform,
  })`);
  check("Menu lateral movil abre", drawer.open, JSON.stringify(drawer));
  await shot("10-mobile-menu.png");

  const exceptions = errors.filter((error) => !/favicon|ERR_FILE_NOT_FOUND|Failed to load resource/i.test(error));
  check("Sin excepciones de runtime", exceptions.length === 0, exceptions.slice(0, 4).join(" | "));

  const failed = results.filter((result) => !result.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks OK`);
  writeFileSync(join(outDir, "smoke-results.json"), JSON.stringify({ results, errors }, null, 2));
  if (failed.length) process.exitCode = 1;
} catch (caught) {
  console.error("SMOKE ERROR", caught);
  console.error("ERRORES DE CONSOLA", errors.slice(0, 10));
  try {
    const dump = await evalJs(`({ hash: location.hash, body: document.body.innerText.slice(0, 800), html: document.querySelector('#root')?.innerHTML.slice(0, 600) })`);
    console.error("DUMP", JSON.stringify(dump));
  } catch {
    /* la pagina puede estar cerrada */
  }
  writeFileSync(join(outDir, "smoke-results.json"), JSON.stringify({ results, errors, fatal: String(caught) }, null, 2));
  process.exitCode = 1;
} finally {
  try {
    ws?.close();
  } catch {
    /* ignorado */
  }
  proc.kill();
}
