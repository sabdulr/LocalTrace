@echo off
cd /d "%~dp0"
set ELECTRON_RUN_AS_NODE=
if exist "release-v0.2.0\win-unpacked\LocalTrace.exe" (
  start "" "release-v0.2.0\win-unpacked\LocalTrace.exe"
  exit /b
)
if exist "release\win-unpacked\LocalTrace.exe" (
  start "" "release\win-unpacked\LocalTrace.exe"
) else if exist "node_modules\electron\dist\electron.exe" (
  set ELECTRON_RUN_AS_NODE=
  start "" "node_modules\electron\dist\electron.exe" .
) else (
  echo Build LocalTrace or run its installer first. See README.md.
  pause
)
