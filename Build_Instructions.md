# LocalTrace build instructions

Applies to version **0.2.0**, including the browser addition. Run commands from the project root. Browser commands support Node/npm on Windows, Linux, and macOS; desktop packaging sections use PowerShell and target Windows x64. Adjust workspace paths as needed.

## Browser setup and launch

For this prepared Windows checkout, double-click `Launch LocalTrace Web.cmd`, then visit `http://127.0.0.1:4173`. Keep its terminal open. The launcher requires `dist/index.html` and installed dependencies. It checks Node on PATH, `%ProgramFiles%\nodejs\node.exe`, then `node_modules\electron\dist\electron.exe` with `ELECTRON_RUN_AS_NODE=1`. It does not install packages or rebuild assets. `Launch LocalTrace.cmd` launches the separate desktop version.

For a fresh machine, install Node.js **22.12 or newer** with npm for the target OS/architecture, reopen the terminal, and check `node --version` and `npm --version`. Then run:

```sh
npm ci
npm test
npm run web
```

`npm run web` builds the React assets and starts the Node server. Open `http://127.0.0.1:4173`. Later launches use `npm start`; after source changes, run `npm run build` again. Stop the server with Ctrl+C. Change ports with `$env:PORT='4174'; npm start` in PowerShell or `PORT=4174 npm start` on Linux/macOS. Use the server's printed address; the Windows launcher introductory message always shows the default port.

The browser application requires `dist`, `server`, `core`, `electron/worker.cjs`, package metadata, and installed production dependencies. Static hosting of `dist` or opening `index.html` directly cannot supply the conversion API. The server binds only to loopback; public hosting and LAN access are not configured. Install native dependencies separately on each OS; never copy Windows `node_modules` to Linux/macOS. Initial setup needs internet access, but conversion does not. A normal Node web launch does not run Electron.

If npm is missing but Node works and the optional workspace fallback exists, use `node .tools/package/bin/npm-cli.js start`. The fallback supplies npm only, not Node. If both commands are missing, use the prepared Windows launcher or install Node/npm. Avoid fallback `run web`, which invokes nested npm commands: use `node .tools/package/bin/npm-cli.js run build` then `node server/server.cjs` instead.

## Browser verification and distribution

```sh
npm run build
npx playwright install chromium
npm run test:web
```

Alternatively test installed Edge on Windows:

```powershell
$env:LOCALTRACE_BROWSER_CHANNEL = 'msedge'
npm run test:web
Remove-Item Env:LOCALTRACE_BROWSER_CHANNEL
```

Use channel `chrome` for installed Chrome. On Linux/macOS, set the variable as `LOCALTRACE_BROWSER_CHANNEL=chrome npm run test:web`. Stop any existing server on port 4173 before testing: the test configuration starts its own server there.

Web tests cover conversion, editing/undo, SVG/PNG/DXF/ZIP downloads, project reopening, the PDF print surface, and cross-origin/invalid-document rejection. They stub printing and do not verify an actual saved PDF or printer output. Check PDF dimensions and browser print settings manually.

The browser addition passed the production build, 32 unit/integration tests and two Edge browser tests on Windows. Linux/macOS and other browsers still need direct verification. The desktop build script does not run browser tests or produce a separate web release archive; run these checks explicitly. A web distribution needs the server, worker, assets and dependencies described above, plus license notices; exclude private projects and unrelated release folders.

## Windows desktop: build all desktop artifacts automatically

Double-click `Build_LocalTrace.cmd`, or run the script from any working directory:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File 'D:\dev_workspaces\gitCode\local\SVGTrace-Local\scripts\build.ps1'
```

The script locates the project root, checks Node/npm and version consistency, installs locked dependencies if the builder is missing, runs unit/integration and desktop tests, builds the renderer and notices, packages **both NSIS and single-file portable targets**, tests the unpacked application, and creates a portable-folder ZIP. Each build uses a new directory under `release-builds`, leaving existing application folders untouched.

```text
release-builds/LocalTrace-<version>-<timestamp>-<suffix>/
  LocalTrace-Setup-<version>-x64.exe
  LocalTrace-Portable-<version>-x64.exe
  LocalTrace-PortableFolder-<version>-x64.zip
  win-unpacked/LocalTrace.exe
  documentation/
  SHA256SUMS.txt
  build-manifest.json
```

Options:

```powershell
# Reinstall the locked dependencies even if node_modules exists:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build.ps1 -InstallDependencies
# Explicitly skip both unit and desktop tests:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build.ps1 -SkipTests
# Use an exact, new destination inside the project; existing paths are rejected:
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/build.ps1 -OutputDirectory 'release-builds/my-release'
```

The script stops on failed external commands and restores its temporary environment changes. Failed builds can leave an incomplete output folder; only a successful run writes the final manifest/checksums. It never deletes existing release folders or stops a running application. Tests cover the direct unpacked executable; separately test the self-extracting portable launcher's extraction and startup before distribution. Signing depends on your build environment; this repository has no certificate configured.

The remaining sections explain prerequisites and equivalent manual commands. `npm run dist` remains the manual NSIS-only workflow; `npm run dist:all` invokes the complete PowerShell script.

## 1. Understand the outputs

| Output | Purpose | Files to distribute |
| --- | --- | --- |
| NSIS installation executable | Installs LocalTrace with an uninstaller | `LocalTrace Setup 0.2.0.exe` |
| Unpacked portable application | Runs without installation | The **entire** `win-unpacked` folder, including `LocalTrace.exe`, `resources`, DLLs, locales, and other supporting files |
| Single-file portable executable | Self-extracting application that runs without installation | The executable produced by Electron Builder's `portable` target |

`LocalTrace.exe` inside `win-unpacked` is **not** a standalone executable. Copying only that file will not produce a working application. The installer and unpacked portable build have been built and tested in this workspace. The optional single-file portable recipe below uses the installed builder's supported target; that artifact was not part of the original 0.2.0 verification.

## 2. Install the prerequisites

1. Use Windows x64.
2. Install Node.js **22.12 or newer**, including npm. The original workspace used Node 24.22.1. Keep `package-lock.json` to reproduce the dependency versions.
3. Open a new PowerShell window after installing Node.
4. Check the tools:

```powershell
node --version
npm --version
```

5. Have internet access for dependency installation and the first packaging run. npm packages, Electron, and the NSIS packaging tools must be downloaded. Once packaged, LocalTrace runs offline. A completely offline build requires those packages and tool caches to have been provisioned already; `npm ci` alone does not guarantee that.

The normal path uses prebuilt Sharp binaries and Electron; it does not require Python, Rust, or Visual Studio build tools. Compiling native dependencies from source is a separate workflow.

## 3. Prepare the source

```powershell
Set-Location 'D:\dev_workspaces\gitCode\local\SVGTrace-Local'
npm ci
```

Run this from a complete source checkout, including `package.json`, `package-lock.json`, `core`, `electron`, `src`, `scripts`, and `vendor-licenses`. `npm ci` installs the locked dependencies and replaces an existing `node_modules` directory. It does not remove your source or release folders.

If Electron reports a missing runtime after dependency installation, run this once while online:

```powershell
node node_modules/electron/install.js
```

Do not replace the pinned VTracer alpha engine with another version without testing its adapter and geometry output.

## 4. Build and verify the application code

Close any running LocalTrace instances after saving your work, especially instances launched from the release folder you plan to rebuild.

```powershell
Remove-Item Env:LOCALTRACE_DEV -ErrorAction SilentlyContinue
Remove-Item Env:ELECTRON_RUN_AS_NODE -ErrorAction SilentlyContinue
Remove-Item Env:LOCALTRACE_PACKAGED -ErrorAction SilentlyContinue
npm test
npm run build
npm run test:e2e
```

Run each command only after the previous command succeeds. `npm run build` checks TypeScript and creates the renderer assets in `dist`. **It does not create a Windows executable.** The desktop test launches Electron and exercises an offline conversion, editing, exports, and project reopening. Its native file pickers are substituted by automation.

The 0.2.0 baseline has 32 unit/integration tests plus one desktop workflow test. Test counts will change as the project grows. Screenshots and test exports are written to `test-results`; later test runs may replace them.

Optional source-build launch:

```powershell
npm run desktop
```

## 5. Build the installation executable

The simplest command is:

```powershell
npm run dist
```

This runs the renderer build, regenerates `THIRD_PARTY_NOTICES.md`, and runs Electron Builder's Windows NSIS target. It does not run the tests automatically; perform step 4 first.

Current output:

```text
release-v0.2.0/
  LocalTrace Setup 0.2.0.exe
  LocalTrace Setup 0.2.0.exe.blockmap
  win-unpacked/
    LocalTrace.exe
    resources/
    ...supporting files...
```

Distribute the setup executable for manual installation. The `.blockmap` file is packaging metadata; this application has no automatic update service configured. Keep the full unpacked folder if you want to run it directly.

Alternative helper, run from the repository root:

```powershell
powershell -ExecutionPolicy Bypass -File scripts/build.ps1
```

The execution-policy setting applies to this PowerShell invocation. The helper now builds all distributions in a fresh `release-builds` directory, runs tests by default, and supports the workspace-local npm fallback. For the manual NSIS-only workflow, the explicit commands below make those stages easy to check:

```powershell
npm run build
npm run notices
node node_modules/electron-builder/cli.js --win nsis --x64
```

## 6. Build the unpacked portable application only

You can skip making an installer:

```powershell
npm run build
npm run notices
node node_modules/electron-builder/cli.js --win --x64 --dir --config.directories.output=release-portable
```

Run:

```powershell
& '.\release-portable\win-unpacked\LocalTrace.exe'
```

To distribute it as a ZIP:

```powershell
Compress-Archive -Path '.\release-portable\win-unpacked\*' -DestinationPath '.\release-portable\LocalTrace-0.2.0-win-x64-folder.zip'
```

Choose a new ZIP filename if it already exists. Recipients must extract the ZIP fully before launching `LocalTrace.exe`. Keep all supporting files together. No Node.js installation is needed on the recipient's computer.

## 7. Build an optional single-file portable executable

```powershell
npm run build
npm run notices
node node_modules/electron-builder/cli.js --win portable --x64 --config.directories.output=release-single-portable
```

Find the resulting `.exe` in `release-single-portable`. Electron Builder controls its default filename; inspect the output rather than confusing it with the NSIS setup executable. This target extracts its bundled application to a temporary directory when launched. Allow extra startup time and test it on a normal Windows account with writable temporary storage.

This is a different distribution from `win-unpacked/LocalTrace.exe`. The single-file launcher and its extraction behavior need their own manual launch/offline test. The automated packaged test below is intended for the direct executable in `win-unpacked`, not the self-extracting launcher.

## 8. Test the actual packaged application

For the default installer build:

```powershell
$env:LOCALTRACE_PACKAGED = (Resolve-Path '.\release-v0.2.0\win-unpacked\LocalTrace.exe').Path
npm run test:e2e
Remove-Item Env:LOCALTRACE_PACKAGED
```

For the portable-only build, substitute `release-portable` for `release-v0.2.0`.

Also perform the manual checks in [Release_Checklist.md](Release_Checklist.md). Real Inkscape/Cricut imports and machine output are separate checks; the automated suite does not certify them.

## 9. Update an existing portable folder

1. Save your projects and close LocalTrace.
2. Back up any personal files stored inside that folder. Keep projects outside release folders in future.
3. Build into a separate destination so a running application cannot leave the build half-updated.
4. Replace the **complete application folder**, or copy the complete new build into the existing application folder after closing it. Use the same Windows architecture.
5. Verify the updated executable with the packaged test and a normal launch.

Do not update only `LocalTrace.exe` or only `resources/app.asar`; the executable, integrity metadata, JavaScript/WASM, and native libraries must belong to the same build. Do not force-terminate an instance containing unsaved work.

The legacy `release/win-unpacked` folder was separately updated to 0.2.0 in this workspace. Future builds currently go to `release-v0.2.0`; they do not automatically refresh that legacy folder. `Launch LocalTrace.cmd` prefers `release-v0.2.0`, then the legacy folder, then development Electron.

## 10. Change the application version

1. Update the root `version` in `package.json`.
2. Synchronize the lockfile with `npm install --package-lock-only`.
3. Update `build.directories.output` in `package.json` if using a versioned output folder.
4. Update the folder preference in `Launch LocalTrace.cmd` and documentation examples as needed. The complete build script reads the application version automatically and creates a fresh output folder; it has no hard-coded version to change.
5. Repeat the tests and packaging steps.

Electron Builder derives executable metadata and installer naming from the application version. Renaming an old `.exe` does not update the software inside it.

## Workspace-local npm fallback

This workspace includes a bootstrapped npm under `.tools`, which is ignored by source control and is not guaranteed to exist in a new checkout. Prefer a normal Node/npm installation for a fresh machine.

When the fallback exists, substitute:

```powershell
node .tools/package/bin/npm-cli.js ci
node .tools/package/bin/npm-cli.js test
node .tools/package/bin/npm-cli.js run build
node .tools/package/bin/npm-cli.js run test:e2e
node scripts/notices.cjs
node node_modules/electron-builder/cli.js --win nsis --x64
```

Calling `run dist` through the fallback still invokes nested `npm` commands, which may fail when npm is absent from PATH. The explicit build/notices/builder sequence avoids that dependency. Electron Builder may report npm discovery failure and fall back to traversing installed dependencies; verify the packaged executable rather than treating a fallback message as proof of a broken build.

## Signing and redistribution

The current build is unsigned. A Windows publisher warning is expected; signing requires a certificate and a separately configured signing process. Include generated notices and the native-library license information. Check current dependency advisories and redistribution obligations before publishing a release. See [support.md](support.md) for build failures and runtime troubleshooting.
