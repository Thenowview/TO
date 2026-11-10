@echo off
cd /d "%~dp0"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0Setup-TheOrg.ps1"
if errorlevel 1 (
 echo.
 echo Setup did not complete. Read the error above and keep this window open.
 pause
)
