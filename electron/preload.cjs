// Puente mínimo y seguro entre Electron y la interfaz web.
const { contextBridge } = require("electron");

contextBridge.exposeInMainWorld("desktopApp", {
  isDesktop: true,
  platform: process.platform,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
});
