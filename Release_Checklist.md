# LocalTrace release checklist

Use this alongside [Build_Instructions.md](Build_Instructions.md). Check items only after performing them; this file is a reusable checklist, not a claim that every item has been completed.

## Source and build

- [ ] Identify release mode: local browser application, Windows desktop, or both; record tested OS/architecture/browser versions separately.

- [ ] Set the application version and synchronize the lockfile.
- [ ] Align output folder names in package configuration, scripts, launcher and documentation.
- [ ] Save/close running applications or choose a fresh output folder.
- [ ] Install locked dependencies with `npm ci`.
- [ ] Run unit/integration tests successfully.
- [ ] Run the TypeScript/renderer build successfully.
- [ ] Run the source-build desktop test successfully.
- [ ] Regenerate third-party notices and confirm required license texts exist.
- [ ] Review runtime and development dependency advisories; record unresolved findings and their scope.
- [ ] Build the intended artifacts: NSIS installer, complete portable folder, and optional single-file portable launcher.

## Browser verification (when releasing browser mode)

- [ ] Install dependencies on each target OS/architecture; do not reuse another platform's `node_modules`.
- [ ] Run `npm test`, `npm run build`, and `npm run test:web` explicitly; the desktop build script does not run web tests.
- [ ] Stop existing port-4173 servers before web automation; record the Playwright browser/channel used.
- [ ] Verify fresh setup with Node/npm, `npm run web`, later `npm start`, and clean shutdown with Ctrl+C.
- [ ] On Windows, test `Launch LocalTrace Web.cmd` with the available runtime, including its Electron fallback when Node is absent from PATH.
- [ ] Verify a clear failure when dependencies/build assets are absent; confirm the desktop launcher remains separate.
- [ ] Check conversion, palette preview, editing, undo/redo, cleanup/merge and cancellation.
- [ ] Download/reopen a project and retrace embedded source; verify browser Save and Save as both create downloads.
- [ ] Inspect SVG, PNG and DXF outputs and extract the color ZIP to inspect each SVG.
- [ ] Save an actual PDF through the print dialog and inspect physical size, page margins, scaling and headers/footers. Automated tests check the popup only.
- [ ] Test without internet access while retaining loopback access; do not put the browser context fully offline.
- [ ] Verify exact host/origin rejection, invalid project errors, and custom PORT behavior.
- [ ] Test Windows, Linux and macOS and each claimed browser directly. Record untested combinations; Windows Edge results alone do not establish cross-platform verification.
- [ ] Include server, core, plain Node worker, dist assets, package metadata and license notices in a web distribution; arrange target-platform dependencies. Exclude private projects, unrelated release folders and test artwork.
- [ ] Record that this server is loopback-only and no public hosting/LAN access is configured. Hash the final web archive if one is produced.

## Desktop packaged verification

- [ ] Run the desktop test against the actual unpacked executable.
- [ ] Launch manually and convert a multicolor PNG with networking disabled.
- [ ] Check curves, thin lines, tiny isolated parts, intentional holes and transparency.
- [ ] Check palette preview, high-quality edge sampling and optional tiny-hole repair.
- [ ] Select/move/recolor an individual shape, recolor a layer, and undo/redo.
- [ ] Save/reopen a project and retrace when source bytes are embedded.
- [ ] Export layered SVG, per-color SVGs, PNG, PDF and DXF; inspect meaningful nonempty outputs.
- [ ] Install and uninstall the NSIS build in an appropriate test environment without putting personal projects inside its application folder.
- [ ] If distributing the single-file portable target, test its extraction, launch and offline conversion separately.

## Interoperability and distribution

- [ ] Import representative SVGs into the actual Inkscape and Cricut versions being supported; verify color separation, holes, closed paths and millimetre dimensions.
- [ ] Inspect DXF geometry in the target CAD/CAM program; document unsupported styling and tolerances.
- [ ] Test a copy on another Windows x64 machine/account without a development toolchain.
- [ ] Confirm all portable resources and native DLLs are included; never distribute only the unpacked `LocalTrace.exe`.
- [ ] Keep license notices, Electron/Chromium notices and native-library information with the distribution.
- [ ] Record whether the executables are signed or unsigned.
- [ ] Generate SHA-256 hashes of final artifacts after all modifications/signing.
- [ ] Record test results and limitations in the release notes. Keep a known good previous build for rollback.

Example hash command:

```powershell
Get-FileHash -Algorithm SHA256 -LiteralPath '.\release-v0.2.0\LocalTrace Setup 0.2.0.exe'
```

Never update a running application's files piecemeal. Save user work, close the app, and replace the complete matching build.
