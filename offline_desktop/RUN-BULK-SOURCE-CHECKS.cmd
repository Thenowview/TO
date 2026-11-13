@echo off
setlocal
cd /d "%~dp0"
where python >nul 2>nul
if errorlevel 1 (
  echo Python 3.10+ is required for source verification.
  exit /b 2
)
python scripts\run_bulk_source_checks.py --report "%TEMP%\TheOrg-Source-Checks.json"
set "status=%ERRORLEVEL%"
echo.
echo Source verification saved to: %TEMP%\TheOrg-Source-Checks.json
echo This is NOT a Windows EXE, Android APK, real GGUF, or release-acceptance test.
exit /b %status%
