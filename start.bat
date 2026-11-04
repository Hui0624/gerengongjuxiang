@echo off
cd /d "%~dp0"

set "NODE_EXE="
for /f "delims=" %%i in ('where node 2^>nul') do if not defined NODE_EXE set "NODE_EXE=%%i"

if not defined NODE_EXE if exist "C:\Users\w\.workbuddy\binaries\node\versions\22.22.2-6\node.exe" set "NODE_EXE=C:\Users\w\.workbuddy\binaries\node\versions\22.22.2-6\node.exe"

if not defined NODE_EXE (
  echo [ERROR] 找不到 Node.js，请先安装 Node.js。
  pause
  exit /b 1
)

REM 启动服务（最小化窗口）；端口已被占用时 server.js 会自动退出，不影响
start "Workbench Server" /min "%NODE_EXE%" server.js

REM 轮询等待服务就绪（最多约 12 秒），再打开浏览器，避免开机时先白屏
set "READY="
for /l %%n in (1,1,24) do (
  curl -s -o nul -w "%%{http_code}" http://localhost:7788/api/ping 2>nul | findstr "200" >nul && set "READY=1" && goto :open
  timeout /t 1 /nobreak >nul
)
:open
start "" "http://localhost:7788"
exit
