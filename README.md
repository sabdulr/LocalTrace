# LocalTrace

A raster-to-vector converter and SVG editor with a browser application for Windows, Linux, and macOS, plus the existing Windows desktop version. All image processing runs on your computer. There are no accounts, remote conversion services, telemetry, runtime CDNs, or external fonts.

## Run in a browser (Windows, Linux, macOS)

For an Ubuntu server, use Docker: copy `.env.example` to `.env`, set `PUBLIC_ORIGIN` to your server's browser URL, then run `docker compose up -d --build`. Open that URL from another computer. See [Docker.md](Docker.md) for complete setup, reverse proxy, health and update instructions. In this mode processing happens on your server.

For Sharp's unsupported-CPU/v2 error on older servers or VMs, set `LOCALTRACE_DOCKERFILE=Dockerfile.compat` in `.env` before building. This compiles Sharp and libvips from source; see [Docker.md](Docker.md).

On this Windows checkout, double-click **Launch LocalTrace Web.cmd** and open **http://127.0.0.1:4173**. The launcher checks Node.js on PATH, the standard Program Files installation, then the existing `node_modules/electron/dist/electron.exe` runtime. It requires an existing `dist/index.html` and installed dependencies. Keep its terminal window open while using the app. `Launch LocalTrace.cmd` launches the separate desktop version.

For a fresh setup on any supported platform, install Node.js 22.12 or newer and npm for your operating system, reopen your terminal, then run these commands from this project folder:

```sh
npm ci
npm run web
```

Open **http://127.0.0.1:4173** in a current browser. After the first build, use `npm start` to launch again. Stop the server with Ctrl+C. To select another port, set the `PORT` environment variable before starting.

The Node.js server runs the existing native Sharp and VTracer engine locally; Electron is not required to run the web version. Install dependencies separately on each operating system rather than copying `node_modules` from Windows. Initial installation needs internet access; running the application does not. This is a locally served web application, so double-clicking `dist/index.html` or hosting only the static files will not run conversions. The server binds only to loopback and is intended for use on the same computer as the browser.

The browser version retains tracing, palette controls, SVG import, layer/path editing, undo/redo, cleanup, merging, and project reopening. Save and Save as both download a `.localtrace.json` project; browsers do not silently overwrite the original file. SVG, PNG, and DXF use downloads. All color SVGs downloads a ZIP. PDF opens the browser print dialog: choose Save as PDF, disable browser headers/footers, and verify paper size and scaling before manufacturing. Browser PDF output depends on the print settings and browser. Allow popups for this local address when exporting PDF.

For development, use `npm run build` followed by `npm start`; rebuild after source changes. `npm run dev` remains the existing Electron renderer development workflow. Run browser integration tests with `npm run build` then `npm run test:web` after installing a Playwright Chromium browser (`npx playwright install chromium`). Set `LOCALTRACE_BROWSER_CHANNEL=msedge` or `chrome` to test with an installed browser instead.

If `npm` is not recognized but `node` works and this checkout contains `.tools/package/bin/npm-cli.js`, use `node .tools/package/bin/npm-cli.js start`. If neither command is recognized, use the Windows web launcher above, or install Node.js with npm and reopen the terminal. The `.tools` fallback supplies npm only; it does not supply Node.js. See [support.md](support.md) for launch and connection errors.

Verification for the browser addition: production build, 32 existing unit/integration tests, and two browser workflow/security tests passed on Windows using Microsoft Edge. The PDF test checks the print surface; it does not verify a saved PDF or printer output. Linux, macOS, and other browsers still need direct verification.

## Documentation

- [Build_Instructions.md](Build_Instructions.md): browser setup and launch, browser tests, Windows installer/portable builds, verification and updates.
- [support.md](support.md): troubleshooting, tracing-quality settings, diagnostics and support guidance.
- [prompt.md](prompt.md): complete standalone prompt for rebuilding LocalTrace from scratch, including the original brief and 0.2.0 requirements.
- [ARCHITECTURE.md](ARCHITECTURE.md): tracing, document state, geometry, security and export implementation.
- [Support_Report_Template.md](Support_Report_Template.md): information to collect when reporting a problem.
- [Release_Checklist.md](Release_Checklist.md): reusable build, testing and distribution checklist.
- [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md): dependency notices and license texts.

## Desktop launch and shared editing workflow

Use `release-v0.2.0/LocalTrace Setup 0.2.0.exe` to install, or run `release-v0.2.0/win-unpacked/LocalTrace.exe` directly. The portable folder must stay intact. `Launch LocalTrace.cmd` opens the portable build when available. This development build is unsigned; Windows may show a publisher warning.

1. Open or drag in an image.
2. Inspect detected colors. Change the color count, add/sample/recolor/remove palette entries, then use **Preview palette** to inspect pixel reassignment.
3. Choose a tracing preset and geometry mode. Click **Convert**. For black-and-white artwork, click **Make black and white** under Source image first. It selects a pure black/white palette and opens the quantized preview, preserving the original and transparency. **Detect colors** restores the source palette; paths change only when converted.
4. Expand color layers on the right to select individual shapes. Shift-click for multiple selection. Drag on the canvas to move shapes.
5. Recolor a layer or selection, set stroke/opacity, duplicate, delete, reorder, hide, or lock layers. Undo/redo uses Ctrl+Z / Ctrl+Y; Delete removes unlocked selected paths.
6. Use **Edit nodes & handles** for anchors and Bézier control handles. Double-click an anchor to remove it. Path operations act on entire selected paths. Breaking compound paths can fill former holes: inspect the result and undo if unsuitable.
7. Export a layered SVG or use **All color SVGs** to export one file per visible color: a ZIP download in the browser, or a new subfolder in the desktop version. A layer's ↗ button exports that ordered layer only. Physical width is in millimetres; height follows the source aspect ratio.

**Save** and **Save as** write `.localtrace.json` projects containing the source bytes, normalized image preview, palette, settings, geometry, styles, visibility, locks, transformations, and physical size. Open projects to resume editing and retracing. Changes are not autosaved; save before closing or opening another file.

## Development

Use Node.js **22.12 or newer** and npm for browser development on Windows, Linux, or macOS. The desktop packaging instructions target Windows x64. Installation and first-time packaging need network access to obtain dependencies. Runtime conversion does not.

```powershell
npm ci
npm run build
npm run desktop
```

For development, run `npm run dev` in one terminal, then `$env:LOCALTRACE_DEV='1'; npm run desktop` in another. Production blocks network requests; development allows only the local Vite server. Run `npm run build` before launching without the dev flag.

If Electron was installed without its runtime, run `node node_modules/electron/install.js` once while online. In this workspace npm was bootstrapped under `.tools/package/bin/npm-cli.js`; `node .tools/package/bin/npm-cli.js run build` is equivalent to `npm run build`.

## Test and build

For an automatic installer + single-file portable + portable-folder ZIP build, double-click `Build_LocalTrace.cmd` or run `powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build.ps1`. It runs tests by default and writes a new versioned/timestamped folder under `release-builds`, including documentation, SHA-256 hashes and a build manifest. Use `-InstallDependencies` for a clean dependency install or `-SkipTests` to explicitly skip validation. See [Build_Instructions.md](Build_Instructions.md) for all options.

```powershell
npm test
npm run build
npm run test:e2e
powershell -ExecutionPolicy Bypass -File scripts/build.ps1
```

Unit/integration tests perform actual VTracer conversions, parse SVG geometry, and compare rendered pixels for clean synthetic artwork. Desktop tests launch Electron, block network access, import generated artwork, convert it, select/duplicate/undo, export SVG/PNG/PDF/DXF, and save/reopen a project. Only native file pickers are substituted in automation. Test screenshots and exports are written to `test-results/`.

To test the packaged executable:

```powershell
$env:LOCALTRACE_PACKAGED=(Resolve-Path 'release-v0.2.0/win-unpacked/LocalTrace.exe').Path
npm run test:e2e
```

The complete build script writes all distributions to a fresh folder under `release-builds/`. `npm run dist` remains an NSIS-only command using `release-v0.2.0/`; `npm run dist:all` runs the complete script. Source, engine adapter, worker, and native Sharp dependencies are bundled. Native DLLs remain unpacked.

## Implemented

- Real VTracer paths; deterministic Lab-based palette extraction and reassignment; transparent and quantized previews.
- PNG, JPEG, WebP, first-frame GIF, uncompressed 8/24/32-bit Windows BMP; SVG paths and common primitive imports. Orientation normalization, source crop and optional resize.
- Logo, vinyl, illustration, high-detail, monochrome-palette and pixel-art presets; speckle filtering, spline/polygon/pixel fitting, simplification tolerance.
- Stacked, cutout, and filled color-silhouette geometry. Painter-order-safe ordered color runs.
- Structured editable layers and paths; native SVG hit testing; multi-select, move, rotation, scale, fill/stroke/opacity, duplicate/delete, layer movement/order/visibility/locking, bounded undo history.
- Basic anchor and handle editing, anchor insertion/removal, path close/break/straighten/smooth operations, plus validated raw path editing.
- Preview small-shape and background-color removal. Preview vector-only boolean union of eligible same-color shapes, with 0.2 px curve-flattening tolerance.
- SVG with Inkscape layer metadata, per-color SVGs, transparent PNG, vector PDF, polyline DXF, millimetre dimensions, optional registration marks.
- Worker-based image processing/tracing/merging with cancellation. Isolated renderer and validated IPC/document data.

## Limits and remaining work

- This is a functional early release, not full SVGTrace parity. Advanced segment-level node selection, tangent constraints, resize/rotation handles, freehand erasing, vacuum, and comprehensive tiny-hole/narrow-channel analysis remain to be added. Rotation and resizing currently use incremental buttons.
- Solid mode fills holes in each color's visible raster regions before tracing. It does **not** infer hidden portions of occluded objects or construct arbitrary semantic objects. Choose layer order yourself for manufacturing.
- Automatic color clustering uses CIE Lab Euclidean distance (Delta E 76), deterministic weighted initialization and 12 iterations. Transparent pixels below alpha 128 are excluded; other pixels become fully opaque. Soft alpha, gradients and photographic detail are approximated. Detected colors can be fewer than requested on simple images.
- PNG/JPEG/WebP/GIF decode via Sharp; BMP is limited to uncompressed BI_RGB. TIFF/HEIF support depends on bundled codecs and is not a guaranteed import format. Sources are capped at 40 MB / 16 megapixels. A malformed or unsupported file reports an error.
- Color layers are contiguous painter-order runs, so a color may appear in several layers. **All color SVGs** collects all visible runs of the same layer color while retaining their order. If individual paths have been recolored differently, that export still follows their layer assignment; move/recolor them consistently before manufacturing export.
- Cutout geometry comes from the pinned VTracer alpha engine. No claim is made that every photo or complex curve will trace perfectly. The synthetic boundary tests use pixel mode; smooth curves can deviate at corners and thin features.
- Imported SVGs support plain paths, groups, rectangles, circles, ellipses, lines and polygons. Scripts, event handlers, images and foreign content are discarded. Text/use/gradients are not imported. CSS styles, clips, masks, filters and advanced paint attributes are rejected instead of silently misrendered. Convert text and effects to plain paths first. Stroke scaling under flattened transforms is not fully preserved; outline strokes before importing scaled artwork.
- Small-shape cleanup uses local path bounding-box area, not exact filled area. Boolean merge accepts only closed, opaque, unstroked paths of one color in one unlocked layer. Its curve flattening is a documented vector approximation; no traced vectors are rasterized for grouping. Merge preview should be applied or cancelled before other edits.
- PNG export uses source document pixel dimensions. Registration marks add a 5 mm outer margin to SVG/PDF/color exports and are not shown on the editor canvas. DXF exports geometry only: curves become polylines with 0.15 source-pixel tolerance; fills, opacity, stroke appearance and registration marks are omitted. Inspect in your CAM software before cutting.
- SVGs include real paths, viewBox, physical dimensions and layer metadata. Actual imports in Inkscape and Cricut Design Space have **not** been manually verified in this environment; physical machine compatibility and minimum features depend on the target software and material.
- Progress is indeterminate because the current synchronous engine does not expose stage progress. Cancel terminates the worker. Automatic retrace/debouncing and segmentation caching are not yet implemented; tracing runs when you click Convert.
- Runtime dependency audit was clean during development. Several moderate findings remain in development-only packaging dependencies, primarily the macOS universal-binary toolchain; see `npm audit`. The installer is unsigned and not a public production release.

See [ARCHITECTURE.md](ARCHITECTURE.md) and [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md). LocalTrace source is MIT; dependencies retain their own licenses. In particular Sharp's dynamically linked libvips has LGPL obligations; review notices before public redistribution.

## 0.2.0 tracing quality update

Spline tracing now defaults to bounded 4× cubic edge sampling before quantization and returns paths to the original coordinate system. Pixel Art stays at native resolution. Default presets disable destructive speckle filtering and use lower simplification tolerances to retain small details. Existing projects retain their saved settings: select Logo or High Detail to use the new defaults. Edge sampling can improve contours but cannot recover information missing from a low-resolution source.

The optional **Fill tiny transparent holes** control repairs only enclosed transparent components up to the entered source-pixel area. It defaults to 0 to preserve intentional holes; use Preview palette to inspect repairs before conversion. Exterior transparency and larger holes are preserved. Supersampling is capped at 16 megapixels. The 48 px circle regression improves alpha silhouette error from about 0.82% to 0.62%; this is a synthetic test, not a guarantee for every image.
