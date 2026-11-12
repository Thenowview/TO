@echo off
setlocal
cd /d "%~dp0"
if not exist "%~dp0tools\Build-TheOrg-Windows-Local.ps1" (
  echo ERROR: This source checkout is incomplete. The local build script is missing.
  pause
  exit /b 1
)
echo =====================================================
echo THEORG - FULL WINDOWS ONEAPP BUILD (REVIEW ONLY)
echo =====================================================
echo Build-machine tools: Python 3.12+ with pip, .NET 8 SDK, Node.js 22.
echo No main-branch merge, deployment or external account action.
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0tools\Build-TheOrg-Windows-Local.ps1"
if errorlevel 1 (
  echo.
  echo BUILD FAILED. Review out\full-oneapp-local-build.log if it exists.
  echo TheOrg has NOT been released or certified.
  pause
  exit /b 1
)
echo.
echo BUILD CANDIDATE READY for Windows acceptance testing.
echo Open out\full-oneapp\TheOrg\START THEORG.cmd
echo This is an unsigned development candidate, not a production release.
pause
exit /b 0
