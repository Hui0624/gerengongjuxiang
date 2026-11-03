@echo off
cd /d "%~dp0"

set "NODE_EXE="
for /f "delims=" %%i in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%i"

if not defined NODE_EXE if exist "C:\Users\w\.workbuddy\binaries\node\versions\22.22.2-6\node.exe" set "NODE_EXE=C:\Users\w\.workbuddy\binaries\node\versions\22.22.2-6\node.exe"

if not defined NODE_EXE (
  echo [ERROR] Node.js not found. Please install Node.js first.
  pause
  exit /b 1
)

start "Workbench Server" /min "%NODE_EXE%" server.js
timeout /t 2 /nobreak >nul
start "" "http://localhost:7788"
exit
