# LocalTrace — complete rebuild prompt

Copy everything below the horizontal rule into a new coding-agent conversation. This prompt is self-contained: it includes the original full project requirements plus the later quality, packaging, support and local browser requirements. It does not require this repository or the original conversation.

The supplemental requirements at the end take precedence where they clarify or change the original brief. The full brief describes the desired scope; it must not be interpreted as a claim that all advanced features were already implemented in version 0.2.0.

---

# Project: LocalTrace — Fully Offline Image-to-SVG Converter and Editor

You are a senior full-stack engineer with experience in image processing, computer graphics, SVG geometry, React, Electron, and desktop application development.

Build a complete, functional application named **LocalTrace**, with a local browser version intended for Windows, Linux and macOS, plus the Windows desktop version. Follow the browser supplement at the end for requirements that supersede desktop-only assumptions in the original brief.

## Objective

Create an offline alternative to https://svgtrace.com/ that converts PNG, JPEG, WebP, BMP, and other commonly supported raster formats into clean, editable, multi-layer SVG files.

The application must separate colours into individual layers and expose the individual vector paths for editing.

**Core requirement:** This must be a functional vectorization application, not a UI mockup or a wrapper that embeds the original raster image inside an SVG.

The application must operate completely offline after installation. It must not require registration, authentication, external APIs, cloud processing, subscriptions, or paid services.

Use SVGTrace.com as a functional reference, but do not copy its proprietary source code, logos, branding, or interface assets.

## Technology Stack

- Electron for the Windows desktop application
- React 19 with TypeScript for the UI
- Vite for development and bundling
- Tailwind CSS for styling
- Zustand for application state
- VTracer as the primary vectorization engine
- Sharp for raster-image preprocessing where appropriate
- OpenCV or OpenCV.js for optional segmentation and cleanup operations
- SVGPathCommander or another maintained SVG path library for geometry manipulation
- Vitest for unit testing
- Playwright for end-to-end testing

Verify package compatibility and licences before implementation. Pin the VTracer engine to a tested release, taking into account that the 1.0 API may still be in alpha. Use an adapter interface to isolate engine-specific calls.

## Required Application Layout

Create a modern dark-themed desktop interface.

LEFT PANEL:
- Upload image
- Drag-and-drop support
- Original image preview
- Image dimensions
- Colour detection settings
- Eyedropper
- Colour palette
- Add/remove/merge colours
- Trace-quality controls

CENTRE PANEL:
- Large interactive SVG canvas
- Original/vector comparison
- Zoom in/out
- Pan
- Fit to screen
- Actual size
- Transparent checkerboard background option
- Shape selection and editing
- Selection bounding boxes

RIGHT PANEL:
- Colour layers
- Expandable individual shapes
- Layer names and HEX colours
- Visibility toggle
- Lock toggle
- Layer reordering
- Shape properties
- Export options

TOP TOOLBAR:
- Open image
- Convert
- Select
- Move
- Recolour
- Delete
- Undo
- Redo
- Save project
- Export SVG

## Image Import

Support:
- PNG
- JPG/JPEG
- WebP
- BMP
- GIF first frame, where supported
- Existing SVG for editing

Requirements:
1. Handle images with alpha transparency.
2. Preserve original dimensions and aspect ratio.
3. Normalize image orientation.
4. Support cropping.
5. Display original file dimensions.
6. Provide optional resizing before tracing.
7. Reject malformed and unsupported files gracefully.
8. Process images locally only.

## Automatic Colour Detection

Implement automatic extraction of representative image colours.

Requirements:
1. Default to 6 colours.
2. Allow 2–16 colours.
3. Detect meaningful dominant colours rather than selecting arbitrary pixels.
4. Use perceptual colour distance, preferably CIE Lab / Delta E, when merging similar colours.
5. Support transparency as a distinct category rather than automatically treating it as white.
6. Provide an eyedropper that samples the original raster image.
7. Allow manual HEX entry.
8. Allow removal and merging of selected colours.
9. Reassign pixels to their nearest selected palette colour.
10. Include a preview of the quantized image before tracing.

Use a deterministic colour quantization approach such as k-means, median cut, or an appropriate built-in algorithm, with reproducible results.

## Vectorization Engine

Use VTracer as the primary image-to-SVG engine.

Implement:
- Full-colour tracing
- Black-and-white tracing
- Colour reduction
- Speckle/noise removal
- Curve smoothing
- Path simplification
- Background transparency preservation
- Configurable detail retention
- Multiple tracing presets

Presets:
1. Logo — clean paths, limited colours
2. Cricut/Vinyl — simplified shapes, clean boundaries
3. Illustration — preserve moderate detail
4. High Detail — maximum practical detail
5. Black & White — monochrome tracing
6. Pixel Art — preserve hard edges

Provide reasonable default settings for each preset.

All controls must be connected to actual engine parameters or documented preprocessing operations. Do not create nonfunctional sliders.

## Multi-Layer SVG Generation

This is the most important requirement.

The output must contain genuine SVG paths grouped into editable colour layers.

Each group must:
- Have a unique ID
- Have a descriptive layer name
- Represent a particular colour
- Contain one or more selectable SVG paths
- Be independently recolourable
- Support visibility and locking in the editor
- Be exportable separately

Preserve the original visual stacking order during rendering.

Do not assume that grouping VTracer paths by fill colour is always visually safe. Implement a layer separation stage that accounts for overlapping shapes and SVG painter's order.

Support three geometric output modes:

1. Stacked mode:
   Preserve the visual stacking order, including any underlying overlapping shapes.

2. Cutout mode:
   Construct the visible colour regions as non-overlapping vector geometry with correct holes.

3. Solid Layer mode:
   Reconstruct full silhouettes suitable for layered vinyl or cardstock projects.

For cutout and solid-layer geometry, use appropriate mask/region operations and polygon boolean operations as required.

Preserve holes and nested paths using correct path winding and fill rules.

Do not rasterize previously generated vector paths merely to group them unless a clearly documented fallback is unavoidable.

## SVG Editor

Implement an SVG editor with:

- Select individual paths
- Multi-select
- Drag to move shapes
- Resize
- Rotate
- Change fill colour
- Change stroke colour
- Change opacity
- Duplicate paths
- Delete paths
- Move paths between layers
- Change layer order
- Hide/show layers
- Lock/unlock layers
- Undo/redo
- Zoom and pan
- Keyboard shortcuts

Support editing existing imported SVG files.

The editor must maintain a structured document model containing layers, shape IDs, path data, transformations, styles, and stacking order.

Do not use the SVG text string as the application's only state representation.

Provide accurate selection hit-testing and bounding boxes.

Use browser-native SVG rendering for the preview, with safe sanitization of imported SVG content.

## Advanced Path Editing

After the base editor is functional, add:

- Anchor point selection
- Anchor point movement
- Add/remove anchors
- Bézier control handles
- Convert corners to smooth points
- Straighten selected segments
- Path simplification
- Close open paths
- Break apart compound paths where possible

Implement these as an isolated editor module.

## Cleanup Tools

Implement:
- Remove small isolated shapes
- Remove selected background colour
- Merge adjacent same-colour regions where geometrically valid
- Simplify paths
- Remove unnecessary nodes
- Detect very small holes and fragments
- Optional local smoothing of rough edges

Use explicit size thresholds.

Provide a preview before destructive cleanup operations.

## Export

Mandatory:
- Layered SVG
- Individual SVG per colour
- Transparent PNG preview

Additional:
- PDF
- DXF

Preserve editable layers and shapes in exported SVGs.

For SVG exports:
- Include correct viewBox
- Preserve aspect ratio
- Support physical dimensions in mm
- Use valid SVG namespaces
- Avoid embedded raster images for traced content
- Use standard SVG paths
- Include meaningful group IDs
- Preserve group colours and visual ordering

For DXF, document any unsupported SVG features and convert geometry appropriately.

Do not silently create invalid or empty export files.

## Cricut and Manufacturing Features

Add a manufacturing mode for:
- Cricut Design Space
- Vinyl cutting
- Layered heat-transfer vinyl
- Cardstock cutting
- Laser engraving
- 3D printing SVG extrusion workflows

Required options:
1. Export each colour as a separate SVG.
2. Export at a user-specified physical width and height in millimetres.
3. Preserve aspect ratio by default.
4. Optional solid silhouettes.
5. Optional registration marks.
6. Remove unnecessary background shapes.
7. Validate that cut paths are closed.
8. Warn about tiny shapes or narrow features.
9. Preview individual colour layers before export.

## Local Project Files

Implement a native project format such as `.localtrace.json`.

Save:
- Original image reference or embedded image data
- Palette
- Conversion configuration
- Layer hierarchy
- Shape geometry
- Layer names
- Visibility
- Lock state
- Transformations
- Physical dimensions

Support Save, Save As, and Open.

## Offline and Security Requirements

- No remote conversion endpoints.
- No telemetry.
- No authentication.
- No account creation.
- No CDN-hosted dependencies at runtime.
- No external fonts or scripts required at runtime.
- All tracing and editing must work with network access disabled.
- Use secure Electron IPC with context isolation enabled.
- Disable unrestricted Node integration in the renderer.
- Validate IPC inputs and local file paths.
- Prevent arbitrary code execution from imported SVGs.
- Sanitize SVGs before rendering.
- Block scripts, external references, event-handler attributes, and unsafe embedded content.
- Package all required conversion components with the application.

## Performance

- Avoid blocking the UI while tracing.
- Use workers or background processes for expensive operations.
- Show progress indicators where the engine supports meaningful progress.
- Allow cancellation where technically supported.
- Debounce rapid parameter changes.
- Cache preprocessing results when appropriate.
- Provide reasonable memory limits for large images.
- Clean up intermediate files and allocated resources.

## User Experience

The default workflow should be:

1. Open image.
2. Automatically detect colours.
3. Inspect or adjust the colour palette.
4. Choose a tracing preset.
5. Click Convert.
6. Preview the layered SVG.
7. Expand layers and edit individual shapes.
8. Export the complete layered SVG or individual colour layers.

The application must be understandable without reading technical documentation.

## Testing

Implement tests covering:

1. Solid black image on white background.
2. Two-colour logo.
3. Multicolour illustration.
4. PNG containing true transparency.
5. JPEG with compression artifacts.
6. Image with nested holes.
7. Multiple disconnected shapes of the same colour.
8. Thin lines and small details.
9. Same-colour shapes at different stacking depths.
10. Overlapping shapes with partial occlusion.
11. Imported SVG containing unsafe script content.
12. Round-trip save/load of an editable project.
13. Offline conversion with network access blocked.

Validate generated SVG files by parsing their XML and inspecting their geometry.

Compare rendered SVG output against expected test images using appropriate visual regression metrics.

For clean synthetic artwork, preserve colour and shape boundaries accurately. Report visual differences rather than silently accepting poor results.

## Deliverables

Create:

1. Complete source code.
2. Working application with functional conversion.
3. Functional SVG editor.
4. Local layer-separation pipeline.
5. SVG export functionality.
6. Automated tests.
7. README with setup and development instructions.
8. Build instructions.
9. Windows installer/build configuration.
10. Architecture documentation describing tracing, colour segmentation, path grouping, and export.

Include appropriate open-source notices and licences.

## Implementation Instructions

Work incrementally in this order:

Phase 1:
- Bootstrap Electron, React and TypeScript.
- Create the application interface.
- Implement image upload and preview.
- Integrate VTracer.
- Produce a real SVG from an uploaded raster image.
- Implement automatic palette detection.
- Display traced colour layers.
- Export SVG.

Phase 2:
- Implement a structured SVG document model.
- Implement layer and path selection.
- Add colour editing.
- Add shape movement and transformations.
- Add undo/redo.
- Add layer visibility, ordering and locking.

Phase 3:
- Implement robust colour separation.
- Implement cutout and solid-layer modes.
- Add individual colour exports.
- Add manufacturing presets.
- Add path cleanup and advanced editing.
- Implement optional PDF/DXF exports.

Phase 4:
- Implement comprehensive tests.
- Improve error handling and performance.
- Complete desktop packaging.
- Verify offline operation.

## Coding Standards

- Use TypeScript strict mode.
- Use modular, maintainable architecture.
- Separate UI, image processing, tracing, document state, and export.
- Use typed interfaces.
- Avoid tightly coupling the UI to a specific tracing library.
- Do not introduce cloud dependencies.
- Do not substitute placeholder implementations for required functionality.
- Document technical limitations honestly.
- Maintain usable application functionality at the end of each phase.

## Definition of Done

The application is successful when a user can:

1. Launch LocalTrace on Windows without an internet connection.
2. Load a multicolour PNG.
3. Detect and select the colours to preserve.
4. Convert it into genuine SVG vector paths.
5. See independently editable colour layers.
6. Select and modify an individual shape.
7. Change an entire layer's colour.
8. Export a valid layered SVG.
9. Reopen that SVG in Inkscape.
10. Import the SVG into Cricut Design Space with usable vector geometry.

Begin by creating the repository architecture and implementing Phase 1.

Do not stop after generating a UI prototype. Run the application, perform an actual conversion test using generated test artwork, and verify that the exported SVG contains real vector paths and colour-separated groups.

Once Phase 1 is working and tested, continue with the next phases as far as the environment permits. Clearly identify what has been completed, what remains, and any known limitations.


# Supplemental requirements — quality, reproducibility and delivery

These instructions are part of the task. They incorporate lessons from LocalTrace 0.2.0 and take precedence over conflicting defaults in the original brief.

## Start and work incrementally

Create the source files and run actual code. Do not stop after a plan or UI prototype. Begin with Phase 1 and continue with a usable application through subsequent phases as the environment permits. Preserve working functionality at each stage. Report exactly which features are complete, partial, missing, or unverified. Do not label an incremental first release as complete parity with SVGTrace.

If working in an existing workspace, inspect applicable repository instructions and preserve unrelated user changes. Do not introduce external conversion services, sign-up, payments or telemetry. Treat SVGTrace as a functional reference only; do not copy proprietary source, branding, logos, or interface assets. Do not infer its private tracing implementation from its public feature descriptions.

## Dependency baseline

The following versions were used in the working 0.2.0 source. They are a reproducibility baseline, not a claim that they remain the latest or free of future advisories. Verify registry metadata, compatibility, licenses and current advisories before a new build. Prefer tested patches when justified, and document any departure. Pin selected versions and commit a lockfile. Keep the VTracer adapter isolated, especially when changing alpha APIs.

Production packages:

```json
{
  "@visioncortex/vtracer": "1.0.0-alpha.4",
  "@xmldom/xmldom": "0.9.12",
  "polygon-clipping": "0.15.7",
  "react": "19.3.1",
  "react-dom": "19.3.1",
  "sharp": "0.35.5",
  "svgpath": "2.6.0",
  "zustand": "5.1.0"
}
```

Development packages:

```json
{
  "@playwright/test": "1.65.1",
  "@tailwindcss/vite": "4.1.17",
  "@types/react": "19.2.2",
  "@types/react-dom": "19.2.2",
  "@vitejs/plugin-react": "5.1.1",
  "electron": "45.3.2",
  "electron-builder": "26.18.0",
  "prettier": "3.10.1",
  "tailwindcss": "4.1.17",
  "typescript": "5.9.3",
  "vite": "7.3.8",
  "vitest": "4.1.12"
}
```

Use Node.js 22.12 or newer for the browser baseline and Windows x64 for desktop packaging. A known development runtime was Node 24.22.1. Browser implementation is intended for Windows, Linux and macOS; report each OS/architecture/browser as verified only after direct testing. Initial installation/building can require network downloads; runtime conversion must not require internet access. Browser mode still requires local HTTP access to its server.

## Required architecture

Keep these responsibilities separate, using these paths or equally clear equivalents:

- electron/main.cjs: secure IPC registration, sender validation, native dialogs, validated project I/O, export orchestration and worker lifecycle.
- electron/preload.cjs: a small allowlisted API exposed through contextBridge; no generic filesystem or arbitrary IPC capability.
- electron/worker.cjs: background decode, palette, trace and geometry work, with cancellation by worker termination when necessary.
- core/engine.cjs: engine-independent adapter accepting typed application settings and returning structured documents.
- core/palette.cjs: deterministic representative palette detection and perceptual pixel reassignment.
- core/quality.cjs: bounded edge sampling, optional tiny-hole repair, and restoration of original SVG dimensions.
- core/document.cjs and core/validate.cjs: sanitized SVG import, structured document validation and SVG serialization.
- core/geometry.cjs, core/cleanup.cjs and core/silhouette.cjs: curve flattening, boolean regions, cleanup and solid silhouettes.
- src/store.ts: structured document state and bounded undo/redo.
- src/pathEditor.tsx: isolated node and Bézier-handle editing logic.
- src/model.ts: strict typed interfaces shared at the renderer boundary.
- tests/: unit, geometry and real conversion regression tests.
- e2e/: desktop workflow tests against both source and packaged executables.

Use a document model with ordered layers, unique layer and shape IDs, path data, transforms, fill, stroke, stroke width, opacity, fill rule, visibility, locking, canvas dimensions and physical dimensions. Do not use one SVG string as the sole state. Support a versioned native project schema containing original raster bytes, palette/configuration, normalized preview when appropriate, and editable document state.

## Correct layer ordering and holes

Grouping every path with the same fill into one global group is unsafe for overlapping artwork. Preserve painter order in stacked mode by keeping contiguous ordered color runs or an equivalent order-preserving representation. The same color can appear in multiple runs. Whole-color exports must collect the appropriate runs without changing their relative drawing order.

Keep intentional holes and nested contours. For cutout mode use tested visible-region/shared-boundary geometry, not a white background pretending to be a hole. Preserve fill rules. Do not rasterize existing vector paths just to regroup them.

Solid mode must have a precise definition. A practical baseline builds each selected color's mask from the original quantized raster, flood-fills exterior background, fills enclosed silhouette holes, and traces the result. This is source preprocessing, not rasterizing existing vectors. It does not recover occluded parts of semantic objects. State that limitation clearly rather than promising hidden-object reconstruction.

Use tested vector boolean operations for eligible same-color merges. The baseline uses polygon-clipping after adaptive curve flattening at 0.2 source-pixel tolerance, correctly classifying outer contours and holes by winding/fill rule. Limit merges to cases where order, fill, opacity and strokes can be handled correctly; reject unsupported cases. Show a preview and support undo.

## Tracing quality requirements

The first implementation suffered from jagged edges and missing small filled regions. Avoid those defaults:

1. Smooth artwork must use spline fitting by default; Pixel Art keeps native hard edges.
2. For Logo, High Detail and comparable presets, default to bounded 4x cubic interpolation of the original RGBA source BEFORE palette reassignment and tracing. Do not upscale an already jagged binary mask and expect recovered contours. Illustration can use 3x. Expose 1x–4x edge sampling.
3. Cap the working raster at 16 megapixels and reduce the requested sampling factor when necessary. Validate file and image sizes before allocation. Bound color lookup caches as well as the JavaScript worker heap; native/WASM memory is not fully constrained by that heap limit.
4. After supersampled tracing, scale path geometry back to the original image coordinate system. Preserve original document dimensions, aspect ratio and physical size. Do not export a 4x-larger artwork by accident.
5. Express user tolerances in source pixels; scale applicable engine tolerances consistently with the sampling factor and respect the engine's accepted parameter bounds.
6. Default speckle removal to 0 so small disconnected components and thin details are not silently discarded. Let the user deliberately choose stronger filtering.
7. Use conservative simplification: around 0.25 source pixels for Logo/Illustration/Black & White, 0.5 for Vinyl, 0 for High Detail and Pixel Art. Verify these choices with actual rendered comparisons rather than assuming every higher setting is better.
8. Expose optional Fill tiny transparent holes as an area threshold in source pixels squared, default 0. Repair only enclosed transparent connected components at or below the threshold, assigning an appropriate neighboring palette color. Never fill exterior-connected transparency or larger intentional holes. Scale area thresholds by sampling factor squared.
9. Palette previews must use the same quality/quantization/repair settings as conversion and display at the original dimensions. Settings changes should be explicit and reflected in previews.
10. Preserve true transparency as a separate category. The 0.2.0 baseline binarized alpha at 128; disclose that approximation or implement a tested improvement. Do not claim preservation of soft alpha if it is thresholded.
11. Existing project settings must round-trip unchanged. Provide an obvious way to select an updated preset; do not silently reinterpret a saved project using new defaults.

Test low-resolution circles/diagonals, small isolated shapes, thin lines, compressed JPEG edges, alpha boundaries, intentional large holes and tiny accidental gaps. Measure actual rendered color/alpha errors and document the metric and resolution. The baseline 48-pixel circle fixture improved normalized alpha silhouette error from roughly 0.82% to 0.62% at higher-resolution comparison. Reproduce the experiment and report your measured result; do not hard-code this historical result as proof that your build passed. Higher sampling is not guaranteed to improve every image. If quality remains poor on user artwork, request a shareable original and problematic SVG after completing independent fixes.

## Editing, safety and manufacturing

All visible controls must perform real operations. Use browser-native SVG hit testing, transformed selection bounds, multi-select, keyboard shortcuts, layer locks and undo/redo. Basic node editing must move real anchors/control handles. Anchor insertion must preserve cubic curves through subdivision; corner smoothing must alter tangents meaningfully. Explain operations that can change topology, such as breaking compound paths filling former holes.

Provide destructive cleanup previews and explicit size thresholds. Do not claim a bounding-box-area heuristic is exact filled-area analysis. Do not claim comprehensive narrow-feature or tiny-hole analysis unless it is implemented and tested.

Use context isolation, renderer sandboxing and disabled Node integration. Validate sender identity, IPC payloads, project fields, path coordinates and transforms. Whitelist SVG geometry and known attributes. Reject DTD/entities, unsafe references, malformed/oversized/deeply nested content, unsupported CSS/effects and invalid geometry. Scripts, event handlers, foreign content, external references and raster image tags must not reach the renderer or exports. Render structured React SVG elements rather than unsanitized markup.

Block remote requests, unexpected navigation and popups in production. Development may allow only the intended local Vite origin. Use native dialogs for file destinations; do not expose an unrestricted path-reading/writing API to the renderer. Keep registration/authentication/telemetry absent.

Manufacturing SVGs need real closed vector paths where appropriate, correct viewBox, millimetre size, preserved aspect ratio, meaningful IDs/layer metadata and optional registration marks. Put each batch color export in a new uniquely named folder so an earlier batch is not silently overwritten. Preview individual layers before export.

Export transparent PNG at document pixel dimensions. PDF can use a hidden isolated Chromium print surface with correct physical page dimensions. DXF can use R2000 lightweight polylines in millimetres, flattening curves at a documented 0.15 source-pixel tolerance. Explicitly disclose omitted fills, opacity, stroke appearance, registration marks or other unsupported features. Do not call SVG-incompatible geometry manufacturing-ready without verification in actual target software.

## Windows builds and updating executables

Deliver:

- A tested Windows NSIS installation executable.
- A tested complete unpacked portable folder containing LocalTrace.exe and all required supporting resources.
- Build instructions for an optional single-file portable target using Electron Builder's portable target; build/test it separately if delivered, since a self-extracting launcher differs from the direct executable.

Bundle the engine WASM, native Sharp binaries, fonts/assets and notices. Keep required native DLLs unpacked. Users must not need Node, Python, Rust, network access or an account to run the installed application.

Explain that the unpacked LocalTrace.exe is not a single-file application. Update the executable, app.asar, matching integrity metadata and supporting resources as one coherent build. Updating only app.asar or only the executable is insufficient. If an existing application is running, ask the user to save and close it before replacing its files; never terminate an unsaved user session. Build into a separate output directory when an old folder is locked. If asked to update the original portable path, copy the complete verified new build after closure and test that exact executable. Do not assume a new installer automatically updates a separate portable copy.

Use consistent version metadata, lockfile, output folder, build helper and launcher paths. Support standard npm workflows and document any environment-specific fallback without assuming it exists in a new checkout. Generate notices before packaging and fail clearly on failed build stages. Current builds can be unsigned, but disclose that and do not describe them as signed production releases.

## Documentation to deliver

Create these files at the repository root:

- README.md: quick start, workflow, supported features, limitations and links to other documents.
- Build_Instructions.md: step-by-step prerequisites, dependency installation, tests, renderer build, NSIS setup, unpacked portable distribution, optional single-file portable build, packaged verification, version updates, signing status and safe replacement of existing executable folders.
- support.md: runtime/build troubleshooting, tracing-quality tuning, transparency/holes, project/export limits, file locks, diagnostics and how to collect a reproducible support report.
- prompt.md: a complete self-contained rebuild prompt containing all these requirements; it must not depend on an attachment or an earlier chat.
- ARCHITECTURE.md: engine adapter, image/color processing, quality sampling, ordering/geometry, model, worker/IPC/security, export and packaging.
- Support_Report_Template.md: version/path, source image properties, complete settings, steps, expected/actual output, errors and shareable attachments. Mention that projects can embed private artwork.
- Release_Checklist.md: automated and manual release checks, offline testing, interoperability, full portable resources, notices and artifact hashes.
- LICENSE and THIRD_PARTY_NOTICES.md plus necessary vendor license texts. Preserve Electron/Chromium notices. Account for Sharp's dynamically linked native libraries and their licenses, including libvips; do not assume every dependency is MIT.

## Acceptance and handover

Provide `scripts/build.ps1` and a double-clickable `Build_LocalTrace.cmd`. The script must run from any working directory, check the Windows x64 Node/npm prerequisites, read the package version dynamically, use the lockfile, stop on failed commands, and support explicit dependency reinstall and test-skipping options. By default run unit/integration tests, the source desktop workflow and the packaged unpacked desktop workflow. Build both NSIS and single-file portable targets, ZIP the entire unpacked application, copy support/build documentation, and emit SHA-256 hashes and a JSON build manifest. Use a fresh output directory under the project for each build, reject existing/unsafe destinations, preserve existing releases, and restore temporary environment changes. Do not claim the self-extracting launcher was launch-tested merely because the unpacked executable passed a test.

Run real conversions and automated tests before delivery. Parse generated SVG XML and inspect actual path geometry and color groups, not just file existence or an .svg extension. Test unsafe SVG import, project validation, hole preservation, painter-order repetitions, partial occlusions, true transparency, malformed input and save/load round trips. Compare rendered results for quality regressions. Exercise conversion and exports with networking disabled in the Electron desktop test and repeat against the packaged direct executable. Native file pickers may be substituted in automated tests; do not substitute the tracing engine or export implementation.

Do not report a build as tested merely because TypeScript compiles. Verify the exact packaged artifact being handed over. Distinguish tests of pixel-mode synthetic geometry from tests of smooth-curve quality. Distinguish installed/portable/source copies and do not leave the user launching an outdated executable after claiming an update.

Finish with links to the actual outputs and documentation, the tests that passed, significant limitations, unsigned status if applicable, and any manual Inkscape/Cricut or machine validation that remains. Do not claim certification or full feature completion without evidence.

# Supplemental requirements — local browser application

This section takes precedence over desktop-only launch, dialog, network and export assumptions above. Preserve the Windows desktop implementation while adding the browser version; do not replace working tracing with a mock or an SVG containing the original raster.

## Runtime and launch

Use the same React/TypeScript editor in a current browser on Windows, Linux and macOS, backed by a local Node.js server. Keep Sharp and the Node VTracer adapter on the server; no browser-only WASM rewrite or remote conversion service is required. Install dependencies on each target OS/architecture. Do not copy Windows native modules to other platforms. Require Node.js 22.12 or newer and npm for fresh installations; distinguish intended portability from directly tested platform support.

Provide these scripts:

```json
{
  "start": "node server/server.cjs",
  "web": "npm run build && npm start",
  "test:web": "playwright test --config playwright.web.config.ts"
}
```

Fresh setup is `npm ci` then `npm run web`. Later launches use `npm start`; source changes require rebuilding. Serve built `dist` assets and the API from one origin at `http://127.0.0.1:4173`, with an optional PORT override. Bind only to loopback. Document Ctrl+C shutdown and the need to keep the terminal open. Static-only hosting, opening `dist/index.html`, and Vite alone cannot provide conversion operations. Public hosting, remote authentication and LAN access are outside this local-server scope.

Provide `Launch LocalTrace Web.cmd` for Windows, independent of `Launch LocalTrace.cmd` for desktop. Resolve Node from PATH, the standard Program Files Node installation, then an existing `node_modules/electron/dist/electron.exe` with `ELECTRON_RUN_AS_NODE=1`. Keep environment changes local to the launcher. Fail clearly if the runtime or built assets are absent; do not silently install packages. The Electron fallback uses its embedded Node runtime without launching a desktop window. Verify it on the target checkout before claiming it works.

Handle both `npm` and `node` command-not-found errors explicitly in documentation. An optional `.tools/package/bin/npm-cli.js` fallback supplies npm only and is not guaranteed in a new checkout. It requires a working Node command. Fallback `run web` still invokes nested npm; use the fallback for `run build` then `node server/server.cjs` if npm is absent from PATH. If both commands are missing, use the prepared Windows launcher when its runtime exists or install Node/npm and reopen the terminal.

## Bridge, workers and server boundary

Keep `window.localtrace` as the typed capability API. `src/browser.ts` installs the browser bridge only if Electron has not already supplied it. Implement a fixed JSON POST API for prepare, trace, cancel, merge, SVG import, project validation and export. Use the shared core and `electron/worker.cjs` as a plain Node worker entry point; that file must not depend on Electron APIs.

Use one engine worker per browser session, and direct cancellation to that session. Session IDs identify jobs rather than authenticate users. Preserve explicit image/project size limits, selection validation and the worker heap bound. Document base64 JSON transport overhead and native/WASM memory limitations. Keep errors visible to users and terminate workers when the server closes.

Require the exact loopback Host including port, same-origin Origin and JSON content type for API calls. Do not enable permissive CORS or expose generic filesystem reads/writes, arbitrary worker operations, shell execution or caller-chosen paths. Confine static asset paths to dist and return appropriate MIME types. Preserve CSP and existing sanitized SVG/document validation. Browser PDF printing intentionally requires a popup; desktop popup blocking remains in place. Do not claim Electron sandbox/navigation controls apply to a normal browser tab.

## Browser files and exports

Read images and projects through browser file inputs, validate projects on the server, and reuse existing project/source fields so projects round-trip between modes. Save and Save as both download `.localtrace.json` files; do not claim automatic overwrite of the opened file. No autosave is required: warn in documentation that reload/tab closure loses unsaved state.

Download layered/per-layer SVG, transparent PNG and DXF. All color SVGs must download one ZIP containing the individual color SVGs instead of prompting for multiple downloads or a native folder. Preserve ordered color runs and validate exported geometry. If writing a ZIP serializer, generate valid headers, offsets, sizes and CRC32 values; verify extraction manually as well as testing signatures.

For PDF, open a print popup during the user action, request the validated SVG, set millimetre page dimensions including registration margins, and invoke the browser print dialog. Report blocked popups clearly. Document Save as PDF, disabled headers/footers, scaling and page-size inspection. Browser settings influence saved output; do not promise the exact behavior of Electron printToPDF. Never use unsafe source SVG markup in the print surface.

## Browser validation and delivery

Provide `playwright.web.config.ts` and `web-e2e/browser.spec.ts`, separate from the desktop suite. Start the local server for browser tests, use a Playwright Chromium browser by default, and support an installed `msedge` or `chrome` channel through LOCALTRACE_BROWSER_CHANNEL. Document `npx playwright install chromium`, the need to free port 4173 before tests, and OS-specific environment-variable syntax.

Exercise actual raster conversion, editable paths/layers, duplicate and undo, SVG/PNG/DXF/color-ZIP downloads, saved-project reopening, PDF popup content, invalid document rejection and cross-origin API rejection. A stubbed print function verifies the print surface only; inspect an actual saved PDF separately. A ZIP signature check alone does not establish complete archive validity. Preserve the existing unit/quality and desktop tests. Test without internet while retaining loopback access; setting the browser fully offline prevents the required HTTP API.

The browser addition's historical verification was a passing production build, 32 unit/integration tests and two browser tests in Edge on Windows. These results are context, not proof of a rebuilt version. Linux/macOS, other browsers, saved-PDF fidelity and archive extraction need direct checks before claiming verification. Record remaining gaps honestly.

Update README.md, Support_Report_Template.md, support.md, Release_Checklist.md, prompt.md, Build_Instructions.md and ARCHITECTURE.md together. Cover launch modes, prerequisites, missing commands, loopback/custom ports, browser downloads and PDF, runtime architecture/security, tests and actual platform verification. The existing Windows desktop build script does not automatically run web tests or create a web archive; run and record browser checks explicitly. A web distribution needs server, core, the plain Node worker, dist assets, package metadata, target-platform production dependencies and license notices. Exclude private projects, unrelated release folders and test artwork. Do not imply the Windows launcher is a standalone cross-platform binary.
