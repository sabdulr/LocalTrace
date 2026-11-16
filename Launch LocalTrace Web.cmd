@echo off
setlocal
cd /d "%~dp0"
if not exist "dist\index.html" (
  echo The browser application must be built first. See README.md.
  pause
  exit /b 1
)
set "LOCALTRACE_NODE="
where node.exe >nul 2>nul
if not errorlevel 1 set "LOCALTRACE_NODE=node.exe"
if not defined LOCALTRACE_NODE if exist "%ProgramFiles%\nodejs\node.exe" set "LOCALTRACE_NODE=%ProgramFiles%\nodejs\node.exe"
if not defined LOCALTRACE_NODE if exist "node_modules\electron\dist\electron.exe" (
  set "LOCALTRACE_NODE=%~dp0node_modules\electron\dist\electron.exe"
  set "ELECTRON_RUN_AS_NODE=1"
)
if not defined LOCALTRACE_NODE (
  echo Node.js was not found. Install Node.js 22.12 or newer and try again.
  pause
  exit /b 1
)
echo Open http://127.0.0.1:4173 in your browser after the server starts.
echo Keep this window open. Press Ctrl+C to stop LocalTrace.
"%LOCALTRACE_NODE%" server\server.cjs
if errorlevel 1 pause
