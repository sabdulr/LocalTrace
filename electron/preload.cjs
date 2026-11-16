const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld(
  "localtrace",
  Object.freeze({
    prepare: (bytes, count, options) =>
      ipcRenderer.invoke("prepare", bytes, count, options),
    trace: (bytes, settings) => ipcRenderer.invoke("trace", bytes, settings),
    cancel: () => ipcRenderer.invoke("cancel"),
    importSVG: (text) => ipcRenderer.invoke("import-svg", text),
    merge: (doc, ids) => ipcRenderer.invoke("merge", doc, ids),
    save: (doc, kind, layerId) =>
      ipcRenderer.invoke("save", doc, kind, layerId),
    openProject: () => ipcRenderer.invoke("open-project"),
  }),
);
