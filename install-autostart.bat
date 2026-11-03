@echo off
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command "$ws=New-Object -ComObject WScript.Shell; $startup=[Environment]::GetFolderPath('Startup'); $p=Join-Path $startup 'Workbench.lnk'; $lnk=$ws.CreateShortcut($p); $lnk.TargetPath='%CD%\start.bat'; $lnk.WorkingDirectory='%CD%'; $lnk.WindowStyle=7; $lnk.Save(); Write-Host ''; Write-Host ('[OK] Autostart installed:'); Write-Host ('  ' + $p)"

echo.
echo To remove it, delete Workbench.lnk from the Startup folder:
echo   Win+R ^> shell:startup
echo.
pause
