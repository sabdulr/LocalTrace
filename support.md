# LocalTrace support and troubleshooting

Applies to version **0.2.0**. LocalTrace runs locally, without accounts, telemetry, or a remote conversion endpoint. There is no automatic crash-report upload or built-in support service.

## Start here

1. Save a `.localtrace.json` project before experimenting. There is no autosave or guaranteed recovery of unsaved edits.
2. Confirm which copy you launched: the local browser server, an installed app, `release-v0.2.0/win-unpacked`, the legacy `release/win-unpacked`, or a development build. Record the browser URL or executable path. Multiple copies can contain different versions.
3. Reproduce with a small PNG and the **Logo** preset. Existing projects retain their saved settings; opening them does not automatically adopt new defaults.
4. Record the exact status-bar error, source dimensions, selected palette, preset, geometry mode, and settings.

## Tracing quality

| Symptom | Checks and actions |
| --- | --- |
| Jagged contours | Use **Logo** or **High Detail**, smooth curves, and **Edge sampling = 4×**. Avoid Pixel Art unless hard pixel edges are wanted. Use a larger original image where available. Sampling improves contour fitting but cannot restore lost source detail. |
| Small shapes disappear | Set **Remove specks = 0**, reduce simplification, and use High Detail. Check that cleanup did not remove them and that their layer is visible. Undo recent cleanup if needed. |
| Tiny transparent spots inside a filled area | Try **Fill tiny transparent holes = 4–16**, inspect **Preview palette**, then convert. The number is area in source pixels squared, not brush radius. Larger thresholds can remove intentional small holes. |
| Large missing area | Check palette reassignment, layer visibility/order, opacity, and source transparency. Small-hole repair does not fill large holes or exterior-connected gaps. Attach the source and exported SVG when requesting help. |
| Holes that should remain are filled | Set tiny-hole repair to **0**, avoid **Solid** mode, and undo compound-path breaking. Use Cutout and check the original image's alpha. |
| Thin lines become distorted | Start with High Detail, specks 0, low simplification, and a higher-resolution source. Compare Original, Quantized, and Vector views to find which stage changes the line. |
| Wrong colors or lost color distinctions | Raise the detected color count, click Detect colors, adjust HEX/palette entries, then Preview palette. Removal reassigns pixels to a remaining palette color. Convert again to update paths. |
| Hairline seams between colors | Compare Cutout with Stacked at several zoom levels and in the export. A renderer's antialiasing can show seams even where regions meet; do not assume a screen seam proves an actual empty region. Save a sample for investigation. |
| Unexpected overlapping layers | Stacked mode intentionally retains underlying shapes. Cutout represents visible regions; Solid fills each color's enclosed silhouette holes and can overlap other colors. |
| Same color appears in multiple layers | This preserves drawing order. Combining every equal color globally can change occlusion. Use All color SVGs for a color-separated export. |

Palette detection defaults to six colors and supports 2–16. It may return fewer colors for simple artwork. Alpha below 128 becomes transparent; other pixels become opaque. Partial alpha, gradients, compression artifacts, and photographic shading are approximated. Transparent pixels are not automatically white.

At 4× edge sampling the number of working pixels can increase by 16×. The app caps sampling at 16 megapixels, so large sources may use a smaller factor. Reduce sampling or source size if conversion is slow. Pixel mode always uses native sampling.

## Editing and export

| Problem | Resolution |
| --- | --- |
| Cannot select or move a path | Check the layer's lock and visibility. Choose Select / Move instead of Pan. Expand the layer and select its shape row. Shift-click adds to a selection. |
| Only one layer is visible | Check **Preview layer** under Export & manufacturing, then layer visibility toggles. A preview filter does not redefine the complete export. |
| Merge is rejected | Select at least two closed, opaque, unstroked shapes of the same fill in one unlocked layer. Apply or cancel the merge preview before further editing. |
| Merge changes a curve slightly | Union uses vector curve flattening at 0.2 source-pixel tolerance. Review the preview; cancel or undo if the approximation is unsuitable. |
| Export says nothing is visible | Ensure a visible layer contains a visible path. An empty or entirely hidden document cannot produce a useful SVG export. |
| Per-color export looks different | It contains the matching color-layer runs without the other colors that previously covered them. Underlying stacked shapes can become visible. Individually recolored paths still belong to their assigned layers. |
| Export size is wrong | Set Physical width in millimetres and verify the receiving application's import units. Height follows the aspect ratio. Registration marks add 5 mm around the artwork. |
| Registration marks are absent on screen | They are export additions and are not shown on the editor canvas. DXF omits them. |
| DXF differs from SVG | DXF contains flattened lightweight polylines in millimetres; fills, opacity, stroke styling, and registration marks are omitted. Curve tolerance is 0.15 source pixels. |
| A cut path is reported open | Inspect/close the selected path using node tools. Do not indiscriminately close intentional linework. The current warning is basic and does not certify manufacturability. |
| PNG has a different appearance | PNG rasterizes the final SVG at the document's pixel dimensions. Inspect the SVG first; transparent areas can appear different against different viewer backgrounds. |

Actual Cricut Design Space and Inkscape interoperability has not been manually certified in this environment. Test import, physical dimensions, holes, layer separation and closure before using material. Minimum line/feature width depends on the machine and material; current warnings do not fully analyze narrow channels.

## Import and project problems

- **Unsupported raster:** PNG, JPEG, WebP, first-frame GIF, and uncompressed 8/24/32-bit BI_RGB Windows BMP are supported. Re-export unusual or compressed BMP variants to PNG. TIFF/HEIF availability depends on the bundled codecs and is not guaranteed.
- **Large source:** limits are 40 MB compressed input and 16 megapixels decoded. Crop or resize externally if the original cannot be opened; the in-app resize control is applied after initial decode checks.
- **Completely transparent image:** no representative opaque palette exists. Check alpha in an image editor.
- **SVG rejected:** convert text and effects to plain paths. CSS, masks, clips, filters, nested viewports, and several advanced paint attributes are rejected. Scripts, event handlers, images, foreign content and other unsupported elements are not imported as editable artwork. Keep the original file; this is not a full SVG-fidelity importer.
- **Scaled SVG strokes look wrong:** outline strokes in the originating editor before import; stroke scaling during transform flattening is not fully preserved.
- **Project rejected:** confirm it is a LocalTrace JSON project and has not been truncated or hand-edited into an invalid schema. Projects are validated and limited to 120 MB. Keep the original rather than attempting destructive repair on your only copy.
- **Convert disabled after project load:** conversion requires embedded source bytes. Vector-only projects/SVG imports can be edited but cannot be retraced without the original raster. Open the original image separately to start a new trace.
- **Save failed:** choose a writable local folder with sufficient space. Save As can choose a new destination. Check project-size errors and preserve an existing good project before retrying.

## Application will not start

### Browser version (Windows, Linux, macOS)

For Docker/Ubuntu deployment, follow [Docker.md](Docker.md). Include `docker compose ps`, relevant container logs, PUBLIC_ORIGIN and the browser URL when reporting connection problems. Docker uses HOST=0.0.0.0 inside the container; exact configured host/origin checks still apply. Processing takes place on the server rather than the browser computer.

If Docker reports Sharp's **Unsupported CPU / v2 microarchitecture** error, set `LOCALTRACE_DOCKERFILE=Dockerfile.compat` in `.env` and rebuild. This compiles both Sharp and libvips from source for older CPUs/VMs. Keep tests enabled. See [Docker.md](Docker.md) for details and verification limits.

On this Windows checkout, double-click `Launch LocalTrace Web.cmd`, wait for the server address, then open `http://127.0.0.1:4173`. Keep the terminal open. This launcher can use the already-installed Electron runtime when Node.js is missing from PATH; it does not install dependencies or build the app. `Launch LocalTrace.cmd` opens the desktop version instead.

For a fresh machine, install Node.js 22.12 or newer with npm, reopen your terminal, and run `npm ci` followed by `npm run web` from the project folder. Subsequent launches use `npm start`. Install native dependencies on each OS; do not copy Windows `node_modules` to Linux or macOS.

| Error or symptom | Action |
| --- | --- |
| `npm` is not recognized | If Node works and the local fallback exists, run `node .tools/package/bin/npm-cli.js start`. Otherwise use the Windows web launcher or install Node.js with npm and reopen the terminal. |
| `node` is not recognized | The npm fallback also requires Node. Use `Launch LocalTrace Web.cmd` with the existing Electron runtime, or install Node.js with npm and reopen the terminal. |
| Connection refused / page cannot load | Keep the server terminal open and check its error text. Use the printed `http://127.0.0.1:<port>` address, not `localhost`, a file URL, or the Vite port. |
| Port already in use (`EADDRINUSE`) | Check whether your existing server is running. Choose another port if needed: PowerShell `$env:PORT='4174'; npm start`; Linux/macOS `PORT=4174 npm start`. Open the matching URL. The Windows launcher's introductory address always shows the default; use the server's actual printed address if PORT is set. |
| Build missing / old interface | Run `npm run build`, restart the server and reload the page. `npm start` serves the existing `dist` build; it does not rebuild source changes. |
| Static page opens but conversion fails | Run the Node server. Hosting only `dist` or opening `index.html` directly does not supply the API. `npm run dev` alone also does not supply the browser API. |
| Save did not overwrite the original | Browser Save and Save as both download projects. Check Downloads and the browser's download settings; reopen the newly downloaded project to verify it. |
| Color files are missing | All color SVGs downloads one ZIP. Extract it to obtain the separate SVG files. |
| PDF does not open | Allow popups for the local server. Choose Save as PDF in the print dialog. Disable headers/footers and inspect paper size, scaling and dimensions. Automated tests verify the print surface, not saved-PDF fidelity. |
| Changes disappeared after reload | Edits are held in browser memory without autosave. Download a project before reloading, closing the tab, or stopping the server. |

The server accepts only local loopback requests with its exact `127.0.0.1` host/port and requires same-origin JSON API requests. LAN access and public hosting are not configured. Internet access is not required once dependencies and assets are installed; local HTTP access must remain available. Do not set browser networking fully offline when testing this mode.

For browser diagnostics, capture the server terminal error and relevant browser developer-console/network error. Review source bytes, project bodies, and local paths before sharing. Windows Edge has been tested; Linux/macOS and other browsers remain to be verified directly.

### Portable folder

Extract the complete application folder before launching. `LocalTrace.exe` needs its adjacent resources, DLLs, and locale files. Do not launch it from inside a ZIP or combine files from different builds. Replace the full build from a trusted source if files are missing.

### Installed application

Save/close any running copy before installing an update. Confirm you are opening the updated installation rather than an old portable shortcut. Back up project files before reinstalling. The application has no automatic updater.

### Development launch

```powershell
Set-Location 'D:\dev_workspaces\gitCode\local\SVGTrace-Local'
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
Remove-Item Env:LOCALTRACE_DEV -ErrorAction SilentlyContinue
npm run build
npm run desktop
```

Without a renderer build, production mode may open an empty window. With `LOCALTRACE_DEV=1`, Vite must be running on `127.0.0.1:5173`. Use a fresh terminal or remove that variable when returning to production mode.

For temporary development diagnostics:

```powershell
$env:ELECTRON_ENABLE_LOGGING = '1'
$env:ELECTRON_LOG_FILE = Join-Path $env:TEMP 'LocalTrace-electron.log'
npm run desktop
# Close the app before reading the log.
Get-Content -LiteralPath $env:ELECTRON_LOG_FILE -Tail 100
Remove-Item Env:ELECTRON_ENABLE_LOGGING
Remove-Item Env:ELECTRON_LOG_FILE
```

Electron logging is explicitly enabled by these commands; LocalTrace does not otherwise provide a dedicated application log viewer or guaranteed crash-log location. If no log is created, capture terminal output and the visible error instead. Review logs before sharing because they can contain local paths.

## Build failures

| Error or symptom | Action |
| --- | --- |
| `npm` not recognized | Install Node with npm, reopen PowerShell, and check PATH. The existing workspace may have `.tools/package/bin/npm-cli.js`; see Build_Instructions.md for the fallback. |
| DNS, proxy, or download failure | Dependency installation and first packaging need network access. Check your network/proxy settings and retry. Offline application operation does not imply the first build can run offline. |
| Electron failed to install correctly | Run `node node_modules/electron/install.js` while online. Confirm the runtime was not excluded by an install policy. |
| Sharp/native module load error | Install dependencies through `npm ci` on the target OS and architecture. Do not copy `node_modules` from another OS. For packaged desktop builds, confirm native files remain in `app.asar.unpacked`. |
| `EBUSY`, locked `.exe`, `.pak`, DLL, or `app.asar` | Save and close LocalTrace. Check Task Manager for remaining LocalTrace processes. Build to a new output folder if a lock remains; do not terminate another user's unsaved session. |
| Builder cannot find npm but uses manual traversal | This can occur with the local npm fallback. Inspect the final packaging result and run the packaged test. A warning followed by a successful fallback is different from a failed build. |
| TypeScript, test, or notices failure | Stop before distribution. Fix the reported stage, rerun the relevant check, and rebuild. Do not reuse an older installer as if it contained the failed source changes. |
| Windows publisher warning | Current builds are unsigned. Confirm provenance and hashes through your trusted distribution process. Do not disable Windows protection globally. |

Full steps: [Build_Instructions.md](Build_Instructions.md).

## Collect a useful support report

Use [Support_Report_Template.md](Support_Report_Template.md). Include the original image and problematic exported SVG when you can share them, a screenshot showing the problem, settings, expected versus actual behavior, exact reproduction steps, version/path, and any error text. A project helps reproduce edit-state problems but can embed the original artwork; review its sensitivity before sharing.

No report is sent automatically. Avoid sending private artwork, secrets, or unrelated files. Synthetic examples are useful when the source cannot be shared.
