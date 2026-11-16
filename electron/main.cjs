const { app, BrowserWindow, ipcMain, dialog, session } = require("electron");
const path = require("node:path");
const fs = require("node:fs/promises");
const { Worker } = require("node:worker_threads");
const { parseSVG, exportSVG } = require("../core/document.cjs");
const { validateDoc } = require("../core/validate.cjs");
let window, worker, projectPath;
function handle(channel, handler) {
  ipcMain.handle(channel, (event, ...args) => {
    if (
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame
    )
      throw Error("Untrusted IPC sender");
    return handler(event, ...args);
  });
}
function validateProject(project) {
  validateDoc(project.document);
  if (
    project.source !== undefined &&
    (typeof project.source !== "string" ||
      project.source.length > 55e6 ||
      !/^[A-Za-z0-9+/=]+$/.test(project.source))
  )
    throw Error("Invalid project source");
  if (
    project.original !== undefined &&
    (typeof project.original !== "string" ||
      project.original.length > 50e6 ||
      !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(project.original))
  )
    throw Error("Invalid embedded project image");
  if (
    !project.settings ||
    !Array.isArray(project.settings.palette) ||
    project.settings.palette.length > 16 ||
    project.settings.palette.some((c) => !/^#[a-f0-9]{6}$/i.test(c))
  )
    throw Error("Invalid project settings");
  return project;
}
function job(operation, args) {
  if (worker) return Promise.reject(Error("Another operation is running"));
  return new Promise((resolve, reject) => {
    const w = new Worker(path.join(__dirname, "worker.cjs"), {
      workerData: { operation, args },
      resourceLimits: { maxOldGenerationSizeMb: 768 },
    });
    worker = w;
    let finished = false;
    const done = () => {
      finished = true;
      if (worker === w) worker = null;
    };
    w.once("message", (m) => {
      done();
      w.terminate();
      m.error ? reject(Error(m.error)) : resolve(m.result);
    });
    w.once("error", (e) => {
      done();
      reject(e);
    });
    w.once("exit", () => {
      if (!finished) {
        done();
        reject(Error("Operation cancelled or worker stopped"));
      }
    });
  });
}
app.whenReady().then(() => {
  session.defaultSession.webRequest.onBeforeRequest((details, cb) =>
    cb({
      cancel:
        !details.url.startsWith("file:") &&
        !details.url.startsWith("data:") &&
        !details.url.startsWith("devtools:") &&
        !(
          process.env.LOCALTRACE_DEV === "1" &&
          /^http:\/\/127\.0\.0\.1:5173\//.test(details.url)
        ),
    }),
  );
  window = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 1100,
    minHeight: 700,
    backgroundColor: "#101318",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (e) => e.preventDefault());
  if (process.env.LOCALTRACE_DEV === "1")
    window.loadURL("http://127.0.0.1:5173");
  else window.loadFile(path.join(__dirname, "../dist/index.html"));
  handle("prepare", (_, bytes, count, options) =>
    job("prepare", [bytes, count, options]),
  );
  handle("trace", (_, bytes, settings) => job("trace", [bytes, settings]));
  handle("cancel", () => {
    worker?.terminate();
  });
  handle("import-svg", (_, text) => parseSVG(text));
  handle("merge", (_, doc, ids) => {
    if (
      !Array.isArray(ids) ||
      ids.length > 20000 ||
      ids.some((v) => typeof v !== "string")
    )
      throw Error("Invalid selection");
    return job("merge", [doc, ids]);
  });
  handle("save", async (_, doc, kind, layerId) => {
    if (
      !["svg", "png", "project", "projectAs", "pdf", "dxf", "colors"].includes(
        kind,
      )
    )
      throw Error("Invalid export format");
    const project = kind.startsWith("project"),
      model = project ? validateProject(doc).document : validateDoc(doc);
    if (kind === "colors") {
      const colors = [
        ...new Set(
          model.layers
            .filter(
              (l) =>
                l.visible &&
                model.shapes.some((s) => s.layerId === l.id && s.visible),
            )
            .map((l) => l.color),
        ),
      ];
      if (!colors.length) throw Error("No visible colors to export");
      const { filePaths } = await dialog.showOpenDialog(window, {
        title: "Export color SVGs to folder",
        properties: ["openDirectory", "createDirectory"],
      });
      if (!filePaths[0]) return false;
      const exports = colors.map((color, index) => {
        const isolated = {
          ...model,
          layers: model.layers.filter((l) => l.color === color),
        };
        return {
          name: `color-${index + 1}-${color.replace(/[^a-z0-9]/gi, "")}.svg`,
          svg: exportSVG({
            ...isolated,
            shapes: model.shapes.filter((s) =>
              isolated.layers.some((l) => l.id === s.layerId),
            ),
          }),
        };
      });
      const output = path.join(
        filePaths[0],
        `LocalTrace-colors-${require("node:crypto").randomUUID().slice(0, 8)}`,
      );
      await fs.mkdir(output);
      for (const item of exports)
        await fs.writeFile(path.join(output, item.name), item.svg);
      return true;
    }
    const svg = project ? null : exportSVG(model, layerId),
      ext = project ? "localtrace.json" : kind;
    const filePath =
      kind === "project" && projectPath
        ? projectPath
        : (
            await dialog.showSaveDialog(window, {
              defaultPath:
                projectPath && project ? projectPath : `artwork.${ext}`,
              filters: [{ name: ext, extensions: [project ? "json" : ext] }],
            })
          ).filePath;
    if (!filePath) return false;
    let data = project ? JSON.stringify(doc, null, 2) : svg;
    if (kind === "png")
      data = await require("sharp")(Buffer.from(svg))
        .resize({
          width: Math.round(model.width),
          height: Math.round(model.height),
          fit: "contain",
        })
        .png()
        .toBuffer();
    if (kind === "dxf") data = require("../core/geometry.cjs").exportDXF(model);
    if (kind === "pdf") {
      const print = new BrowserWindow({
        show: false,
        webPreferences: {
          sandbox: true,
          contextIsolation: true,
          nodeIntegration: false,
        },
      });
      try {
        await print.loadURL(
          "data:text/html;charset=utf-8," +
            encodeURIComponent(
              `<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'"><style>@page{margin:0}html,body{margin:0;padding:0}svg{display:block}</style></head><body>${svg}</body></html>`,
            ),
        );
        data = await print.webContents.printToPDF({
          printBackground: true,
          preferCSSPageSize: false,
          pageSize: {
            width:
              (model.physicalWidth + (model.registrationMarks ? 10 : 0)) / 25.4,
            height:
              ((model.physicalWidth * model.height) / model.width +
                (model.registrationMarks ? 10 : 0)) /
              25.4,
          },
          margins: { top: 0, bottom: 0, left: 0, right: 0 },
        });
      } finally {
        print.destroy();
      }
    }
    if (project && Buffer.byteLength(data) > 120e6)
      throw Error("Project exceeds 120 MB limit");
    await fs.writeFile(filePath, data);
    if (project) projectPath = filePath;
    return true;
  });
  handle("open-project", async () => {
    const { filePaths } = await dialog.showOpenDialog(window, {
      filters: [{ name: "LocalTrace project", extensions: ["json"] }],
      properties: ["openFile"],
    });
    if (!filePaths[0]) return null;
    const stat = await fs.stat(filePaths[0]);
    if (stat.size > 120e6) throw Error("Project too large");
    const project = validateProject(
      JSON.parse(await fs.readFile(filePaths[0], "utf8")),
    );
    projectPath = filePaths[0];
    return project;
  });
});
app.on("window-all-closed", () => {
  worker?.terminate();
  app.quit();
});
