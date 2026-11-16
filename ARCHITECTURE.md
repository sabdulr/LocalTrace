# Architecture

## Boundaries

Docker deployment adds explicit HOST and PUBLIC_ORIGIN configuration. Normal local launch still defaults to loopback. The container listens on `0.0.0.0`; PUBLIC_ORIGIN supplies the one allowed external host/origin, including HTTPS behind a proxy. Forwarded headers are not trusted. `/healthz` supplies process liveness without host validation. SIGTERM/SIGINT close connections and terminate engine workers. The multi-stage Dockerfile builds/tests on Linux, installs production dependencies separately, and runs Node as a non-root user; Compose adds a read-only filesystem. See [Docker.md](Docker.md). Server uploads replace the local-only processing assumption in this mode, and browser downloads remain the persistence mechanism.

The React editor uses the typed `window.localtrace` API in both modes. Electron supplies it through the preload. In a normal browser, `src/browser.ts` installs an HTTP bridge only when the API is absent. Both modes share the editor, model, store, engine, and geometry code.

`server/server.cjs` serves built Vite assets from `dist` and an allowlist of `/api/` operations using Node HTTP. It binds to `127.0.0.1` on PORT (default 4173), checks the exact host/port, requires the matching Origin and JSON content type for API POSTs, and enables no CORS. Request bodies are capped at 120 MB; project/document fields are validated and no browser-supplied filesystem destination is accepted. Static paths are confined to dist. This is a local server without remote authentication or public/LAN hosting configuration.

The browser creates a session ID per page load. The server allows one engine worker per session and cancels only that session's worker. IDs distinguish jobs; they are not authentication credentials. `electron/worker.cjs` is a plain Node worker entry point and does not require Electron. Workers use a 768 MB JavaScript heap limit alongside the engine's image limits. Browser source bytes are base64 in JSON, adding transport/memory overhead. PNG rendering and SVG/project serialization currently execute in the server request handler rather than engine workers.

`electron/main.cjs` owns native save/open dialogs and filesystem writes. The renderer has no Node integration. `electron/preload.cjs` exposes a small typed capability surface under `window.localtrace`. No caller-supplied path is accepted for reads or writes: user-selected native-dialog paths are held in the main process. Main-process project validation rejects unsafe geometry/style fields and external preview references.

`electron/main.cjs` and `server/server.cjs` launch disposable Node workers using `electron/worker.cjs`. The worker calls the engine adapter in `core/engine.cjs`; the renderer does not know VTracer's API. Decode, palette extraction, tracing and region merging happen in workers. Worker termination implements cancellation, and worker exceptions become visible UI errors. WASM/native memory lies partly outside the worker JavaScript heap limit; explicit compressed-file and decoded-pixel limits are the primary memory controls.

`src/store.ts` owns structured documents and a maximum of 40 undo snapshots. Documents contain canvas dimensions, physical width, ordered layers, path IDs, path geometry, fill/stroke/opacity, local transforms and visibility. Layers contain editable names, color labels, locks and visibility. `src/pathEditor.tsx` isolates SVG segment normalization, anchor/handle overlays and path operations. React renders native SVG elements; there is no HTML injection of imported SVG markup.

## Image and color pipeline

1. Sharp decodes raster files, normalizes EXIF orientation, crops/resizes when requested, and provides RGBA bytes. A bounded BI_RGB parser handles common BMP variants.
2. Deterministic histogram bins reduce sampled RGB colors; weighted farthest-point initialization and 12 weighted clustering iterations find representative colors in CIE Lab. Bins are sampled deterministically to at most approximately 30,000 pixels.
3. The selected palette reassigns opaque pixels to their nearest Lab center; exact RGB lookup results are cached for repeated colors. Alpha below 128 remains transparent. Palette preview and tracing use the same quantization.
4. VTracer **1.0.0-alpha.4** is pinned in `package.json` and the lockfile. The Node WASM package accepts quantized RGBA and returns paths. The adapter maps fitting, speckle filtering, geometry composition, and simplification to documented camelCase engine options. Alpha API changes stay behind this boundary.
5. VTracer SVG is parsed into the same sanitized document representation as imported artwork, and validated before use.

### 0.2.0 quality preprocessing

`core/quality.cjs` interpolates source RGBA using cubic sampling before palette reassignment. Sampling is selectable from 1× to 4×, defaults to 4× for most smooth presets, and stays at 1× for Pixel Art. The effective integer factor is reduced to keep the working image within 16 megapixels. Optional repair fills only enclosed transparent components below an explicit source-pixel-area threshold, scaled by the factor squared; it defaults to zero. Preview uses this same preprocessing and returns to source dimensions.

Engine simplification and speckle parameters are scaled for the working resolution, then traced path coordinates are scaled back to the original canvas. Most presets now use zero speckle filtering and conservative simplification to preserve small components. `core/palette.cjs` bounds its repeated-color lookup cache to 65,536 entries. Quality tests compare a low-resolution curved silhouette with its expected higher-resolution rendering, test retention of a small component, check source dimensions, and distinguish tiny-hole repair from intentional-hole/exterior transparency preservation.

## Layer separation and geometry

Stacked output retains underlying engine shapes. The parser walks shapes in painter order and creates a new layer each time the effective fill color or visibility changes. Repeated colors at different depths remain separate runs. Rendering groups in that same order preserves occlusion; grouping every equal fill globally would not. User layer reordering deliberately changes painter order.

Cutout mode delegates shared-boundary visible-region construction to the pinned engine's `hierarchical: cutout`. Closed compound path data and fill rules are retained. The test fixtures render nested holes and partial occlusions and check alpha and color boundaries.

Solid mode starts from each original quantized raster color mask, flood-fills exterior background, and fills enclosed holes. It traces each resulting silhouette and assigns it to its own layer. This reconstructs full outer contours of visible color regions, not occluded semantic objects. It is preprocessing of the original source, not a raster fallback for existing vector paths.

Vector boolean merging flattens curves adaptively at 0.2 px tolerance, classifies nested contours by fill rule/winding, and calls polygon-clipping union. It only merges matching opaque unstroked shapes within one unlocked layer. The merged output has even-odd compound polygons. The UI previews this proposed document before committing an undoable change. This preserves vector geometry through a documented approximation.

## Import, export and security

Security controls differ by host: Electron's sandbox, context isolation, navigation restrictions and request blocking apply to desktop windows. Browser mode uses the page CSP and the local server's host/origin checks. It deliberately opens a print popup for PDF. Browser mode needs local HTTP access even when internet access is disabled; Playwright's fully offline browser mode would block that API.

Browser file input reads images/projects and the server validates project content before use. Both Save and Save as download a project rather than maintaining a persistent writable path. SVG/PNG/DXF use Blob downloads; color SVGs are combined into a stored ZIP with CRC32 entries in `src/browser.ts`. PDF requests validated SVG and writes it to a print popup with millimetre page dimensions; the browser print dialog controls PDF destination, scaling and headers. No server filesystem export is used. Unsaved browser state is lost on reload and is not autosaved.

The XML importer rejects DTD/entities, deeply nested SVGs, invalid dimensions, unsafe paint references, unsupported CSS/effects, and malformed paths. It whitelists geometry element types and reads only known attributes. Scripts, event handlers and foreign markup never enter the document model. Projects undergo separate strict schema/geometry validation before use. Exports escape XML attributes and validate all model fields before writing. The desktop renderer additionally runs with CSP, sandboxing, context isolation, blocked navigation/popups, and blocked network requests in production.

SVG export writes named `<g>` color layers in painter order and real `<path>` elements, retaining holes, styles, transforms and aspect ratio. Physical size uses millimetres; registration marks extend the viewBox while preserving artwork scale. Per-color export filters ordered runs to each visible color. On desktop, native file pickers choose destinations and batch color export creates a new uniquely named subfolder. Browser exports use downloads and a ZIP as described above.

PNG export rasterizes the final SVG locally at document pixel dimensions. Desktop PDF uses a hidden isolated Chromium print surface with physical page dimensions; browser PDF uses the user's print dialog. DXF flattens paths adaptively at 0.15 px tolerance and writes R2000 lightweight polylines in millimetres, with a Y-axis flip. It deliberately omits visual styling and preserves closed-loop flags. No export wraps the input raster in SVG.

## Verification and packaging

`playwright.web.config.ts` starts the local server and runs `web-e2e/browser.spec.ts`. The two web tests exercise actual conversion, duplicate/undo, SVG/PNG/DXF/color-ZIP downloads, project reopening, PDF popup content, cross-origin rejection and invalid documents. Printing is stubbed; ZIP checks establish its signature, not complete archive interoperability. At browser delivery, the build, 32 existing unit/integration tests and the two web tests passed in Windows Edge. Linux/macOS and other browsers remain directly unverified.

`npm run web` builds then serves; `npm start` serves existing assets. Vite alone does not provide the browser API. The Windows web launcher can reuse the installed development Electron runtime as Node when Node is unavailable on PATH. It is not a standalone packaged web distribution. The Windows desktop release script does not include browser tests or create a separate web archive.

Vitest executes real engine, color, sanitation, order, hole, BMP, path-editing and boolean-geometry tests. Synthetic PNG fixtures cover transparency, nested holes, disconnected components, thin lines, color repetitions and occlusions; rendered SVG mismatches must stay below 2.5% of pixels in pixel mode. JPEG testing verifies a successful reduced-color conversion, not a promise of lossless photographic reconstruction.

Playwright launches Electron with production assets and offline networking, exercises worker IPC, edits, undo, exports all supported formats, and round-trips a native project. The packaged executable can run the same test. Tests validate SVG markup and raster/PDF/DXF signatures; they do not replace checking real material/tool behavior in manufacturing software.

Electron Builder packages a Windows x64 NSIS installer. WASM stays bundled; Sharp/native DLLs are unpacked for loading and compatible library replacement. Dependency notices are generated from the installed production lockfile entries, with Electron/Chromium notices supplied by Electron. Public signing, release distribution, and target-machine certification are outside this development build.
