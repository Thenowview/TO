!include "MUI2.nsh"

!define MUI_ICON "..\out\branding\TheOrg.ico"
!define MUI_UNICON "..\out\branding\TheOrg.ico"
Name "TheOrg Browser - Chromium Preview"
OutFile "..\out\installer\TheOrg-Browser-Chromium-Win-x64-unsigned.exe"
InstallDir "$LOCALAPPDATA\Programs\TheOrg Browser"
RequestExecutionLevel user
Unicode true
SetCompressor /SOLID lzma
ShowInstDetails show
ShowUninstDetails show

!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "TheOrg Browser"
!define MUI_WELCOMEPAGE_TEXT "TheOrg is a Chromium-based local-first browser workspace with a bundled Windows AI controller. All required core files are included; no browser download takes place during setup. This is an unsigned developer preview, not a certified production browser."
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Section "TheOrg Browser and local controller"
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  File "..\out\bridge\TheOrg.Bridge.exe"
  File /oname=install-chromium-host.ps1 "..\tools\install-chromium-host.ps1"
  File /oname=TheOrg-Start.ps1 "..\tools\TheOrgChromium-Start.ps1"
  File /oname=BROWSER_SOURCE.txt "..\out\browser\BROWSER_SOURCE.txt"
  File /oname=TheOrg.ico "..\out\branding\TheOrg.ico"
  File /oname=LICENSE.chromium "..\out\browser\LICENSE"
  File /oname=LICENSES.chromium.html "..\out\browser\LICENSES.chromium.html"

  SetOutPath "$INSTDIR\browser"
  File /r "..\out\browser\chrome-win\*.*"

  SetOutPath "$INSTDIR\chrome-extension"
  File /r "..\apps\chrome-extension\*.*"

  CreateDirectory "$SMPROGRAMS\TheOrg Browser"
  CreateShortCut "$SMPROGRAMS\TheOrg Browser\TheOrg Browser.lnk" \
    "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" \
    '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$INSTDIR\TheOrg-Start.ps1"' \
    "$INSTDIR\TheOrg.ico" 0
  CreateShortCut "$DESKTOP\TheOrg Browser.lnk" \
    "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" \
    '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$INSTDIR\TheOrg-Start.ps1"' \
    "$INSTDIR\TheOrg.ico" 0

  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TheOrgChromiumPreview" "DisplayName" "TheOrg Browser (Chromium Preview)"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TheOrgChromiumPreview" "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TheOrgChromiumPreview" "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TheOrgChromiumPreview" "NoModify" 1

  IfSilent skipBrowser
    ExecShell "open" "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" \
      '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$INSTDIR\TheOrg-Start.ps1"'
  skipBrowser:
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  ; Never remove regular Chrome registration or existing independent browser profiles.
  DeleteRegKey HKCU "Software\Chromium\NativeMessagingHosts\com.theorg.bridge"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TheOrgChromiumPreview"
  Delete "$DESKTOP\TheOrg Browser.lnk"
  Delete "$SMPROGRAMS\TheOrg Browser\TheOrg Browser.lnk"
  RMDir "$SMPROGRAMS\TheOrg Browser"
  RMDir /r "$INSTDIR\chrome-extension"
  RMDir /r "$INSTDIR\browser"
  Delete "$INSTDIR\TheOrg.Bridge.exe"
  Delete "$INSTDIR\install-chromium-host.ps1"
  Delete "$INSTDIR\TheOrg-Start.ps1"
  Delete "$INSTDIR\BROWSER_SOURCE.txt"
  Delete "$INSTDIR\TheOrg.ico"
  Delete "$INSTDIR\LICENSE.chromium"
  Delete "$INSTDIR\LICENSES.chromium.html"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  DetailPrint "Saved Chromium profile and local workspaces remain under LocalAppData\TheOrg."
SectionEnd
