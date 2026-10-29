// Proceso principal de Electron para Atril.
// Carga la build de Vite desde un protocolo propio (app://bundle) para que
// localStorage, IndexedDB y las descargas funcionen con un origen seguro.
const { app, BrowserWindow, Menu, protocol, net, session, shell } = require("electron");
const path = require("node:path");
const { pathToFileURL } = require("node:url");

const DEV_URL = process.env.ELECTRON_START_URL || "";
const APP_SCHEME = "app";
const APP_HOST = "bundle";
const APP_ORIGIN = `${APP_SCHEME}://${APP_HOST}`;
const DIST_DIR = path.join(__dirname, "..", "dist");

protocol.registerSchemesAsPrivileged([
  {
    scheme: APP_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

let mainWindow = null;

function resolveAsset(requestUrl) {
  const url = new URL(requestUrl);
  let pathname = decodeURIComponent(url.pathname);
  if (pathname === "/" || !path.extname(pathname)) pathname = "/index.html";
  const target = path.normalize(path.join(DIST_DIR, pathname));
  if (!target.startsWith(DIST_DIR)) return null;
  return target;
}

function registerAppProtocol() {
  protocol.handle(APP_SCHEME, (request) => {
    const target = resolveAsset(request.url);
    if (!target) return new Response("Acceso denegado", { status: 403 });
    return net.fetch(pathToFileURL(target).toString());
  });
}

function buildMenu() {
  const template = [
    {
      label: "Archivo",
      submenu: [{ role: "quit", label: "Salir" }],
    },
    {
      label: "Editar",
      submenu: [
        { role: "undo", label: "Deshacer" },
        { role: "redo", label: "Rehacer" },
        { type: "separator" },
        { role: "cut", label: "Cortar" },
        { role: "copy", label: "Copiar" },
        { role: "paste", label: "Pegar" },
        { role: "selectAll", label: "Seleccionar todo" },
      ],
    },
    {
      label: "Ver",
      submenu: [
        { role: "reload", label: "Recargar" },
        { role: "forceReload", label: "Forzar recarga" },
        { type: "separator" },
        { role: "resetZoom", label: "Zoom normal" },
        { role: "zoomIn", label: "Acercar" },
        { role: "zoomOut", label: "Alejar" },
        { type: "separator" },
        { role: "togglefullscreen", label: "Pantalla completa" },
        { role: "toggleDevTools", label: "Herramientas de desarrollo" },
      ],
    },
    {
      label: "Ayuda",
      submenu: [
        {
          label: "Acerca de Atril",
          click: () => {
            const { dialog } = require("electron");
            dialog.showMessageBox({
              type: "info",
              title: "Atril",
              message: `Atril ${app.getVersion()}`,
              detail: "Gestión de partituras de orquesta.\nVersión de escritorio para Windows.",
            });
          },
        },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    backgroundColor: "#101418",
    title: "Atril · Partituras de orquesta",
    show: false,
    autoHideMenuBar: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      spellcheck: false,
    },
  });

  mainWindow.once("ready-to-show", () => mainWindow.show());

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) shell.openExternal(url);
    return { action: "deny" };
  });

  mainWindow.webContents.on("will-navigate", (event, url) => {
    const allowed = url.startsWith(APP_ORIGIN) || (DEV_URL && url.startsWith(DEV_URL));
    if (!allowed) {
      event.preventDefault();
      if (/^https?:/i.test(url)) shell.openExternal(url);
    }
  });

  if (DEV_URL) {
    mainWindow.loadURL(DEV_URL);
  } else {
    mainWindow.loadURL(`${APP_ORIGIN}/index.html`);
  }

  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

app.whenReady().then(() => {
  app.setAppUserModelId("com.jgarapps.atril");
  registerAppProtocol();
  buildMenu();

  // Las descargas (PDF, MusicXML, respaldos) se guardan con el diálogo del sistema
  // en la carpeta de Descargas del usuario.
  session.defaultSession.on("will-download", (_event, item) => {
    const filename = item.getFilename() || "atril-descarga";
    item.setSaveDialogOptions({
      title: "Guardar archivo de Atril",
      defaultPath: path.join(app.getPath("downloads"), filename),
    });
  });

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});
