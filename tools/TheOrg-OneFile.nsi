!include "MUI2.nsh"

Name "TheOrg — Existing Chrome Developer Preview"
OutFile "..\out\onefile\TheOrg-OneFile-ExistingChrome-Win-x64-unsigned.exe"
InstallDir "$LOCALAPPDATA\Programs\TheOrg-OneFile"
RequestExecutionLevel user
Unicode true
SetCompressor lzma
ShowInstDetails show
ShowUninstDetails show

!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "TheOrg for your existing Chrome"
!define MUI_WELCOMEPAGE_TEXT "One EXE installs TheOrg local AI controller, Chrome extension files, desktop shortcut and file tools.$\r$\n$\r$\nNo extra Chrome or Ollama download.$\r$\n$\r$\nYou must approve Load unpacked once in Chrome. Unsigned developer preview; synthetic test data only."
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Section "Install TheOrg" SecMain
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  File /oname=Setup-OneFile.ps1 "..\tools\Setup-OneFile.ps1"
  File /oname=Test-BridgeConnection.ps1 "..\portable\Test-BridgeConnection.ps1"
  File /oname=Connect-OneFile.ps1 "..\tools\Connect-OneFile.ps1"
  File /oname=Cleanup-OneFile.ps1 "..\tools\Cleanup-OneFile.ps1"
  File /oname=TheOrg-OneFile-START.html "..\tools\TheOrg-OneFile-START.html"
  File /oname=Open-TheOrg.ps1 "..\portable\Open-TheOrg.ps1"
  File /oname=Open-Local-Files.ps1 "..\portable\Open-Local-Files.ps1"
  File /oname=Export-Local-Files.ps1 "..\portable\Export-Local-Files.ps1"
  File /oname=OPEN-LOCAL-FILES.cmd "..\portable\OPEN-LOCAL-FILES.cmd"
  File /oname=EXPORT-LOCAL-FILES.cmd "..\portable\EXPORT-LOCAL-FILES.cmd"

  SetOutPath "$INSTDIR\bridge"
  File "..\out\onefile\bridge\TheOrg.Bridge.exe"
  SetOutPath "$INSTDIR\chrome-extension"
  File /r "..\out\onefile\chrome-extension\*.*"

  CreateDirectory "$INSTDIR\Local-Files"
  SetOutPath "$INSTDIR"

  ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\Setup-OneFile.ps1" -InstallRoot "$INSTDIR"' $0
  StrCmp $0 0 setupOK
    SetErrorLevel 1
    IfSilent setupErrorSilent
      MessageBox MB_ICONSTOP|MB_OK "TheOrg controller setup failed with code $0. See the installer details."
    setupErrorSilent:
    Abort "Controller registration failed"
  setupOK:

  CreateDirectory "$SMPROGRAMS\TheOrg"
  CreateShortCut "$SMPROGRAMS\TheOrg\Open Supervisor in Chrome.lnk" \
    "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" \
    '-NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\Open-TheOrg.ps1"'
  CreateShortCut "$SMPROGRAMS\TheOrg\Connect extension (one time).lnk" \
    "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" \
    '-NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\Connect-OneFile.ps1"'
  CreateShortCut "$SMPROGRAMS\TheOrg\Open local workspace.lnk" "$INSTDIR\OPEN-LOCAL-FILES.cmd"
  CreateShortCut "$SMPROGRAMS\TheOrg\Export generated files.lnk" "$INSTDIR\EXPORT-LOCAL-FILES.cmd"
  CreateShortCut "$DESKTOP\TheOrg - Chrome.lnk" \
    "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" \
    '-NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\Open-TheOrg.ps1"'

  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TheOrgOneFilePreview" \
    "DisplayName" "TheOrg - Existing Chrome (developer preview)"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TheOrgOneFilePreview" \
    "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TheOrgOneFilePreview" \
    "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TheOrgOneFilePreview" "NoModify" 1

  IfSilent skipGuide
    ExecShell "open" "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" \
      '-NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\Connect-OneFile.ps1"'
  skipGuide:
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  ExecWait '"$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" -NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\Cleanup-OneFile.ps1" -InstallRoot "$INSTDIR"'
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TheOrgOneFilePreview"
  Delete "$SMPROGRAMS\TheOrg\Open Supervisor in Chrome.lnk"
  Delete "$SMPROGRAMS\TheOrg\Connect extension (one time).lnk"
  Delete "$SMPROGRAMS\TheOrg\Open local workspace.lnk"
  Delete "$SMPROGRAMS\TheOrg\Export generated files.lnk"
  RMDir "$SMPROGRAMS\TheOrg"

  Delete "$INSTDIR\Setup-OneFile.ps1"
  Delete "$INSTDIR\Test-BridgeConnection.ps1"
  Delete "$INSTDIR\Connect-OneFile.ps1"
  Delete "$INSTDIR\Cleanup-OneFile.ps1"
  Delete "$INSTDIR\TheOrg-OneFile-START.html"
  Delete "$INSTDIR\START-HERE.html"
  Delete "$INSTDIR\Open-TheOrg.ps1"
  Delete "$INSTDIR\Open-Local-Files.ps1"
  Delete "$INSTDIR\Export-Local-Files.ps1"
  Delete "$INSTDIR\OPEN-LOCAL-FILES.cmd"
  Delete "$INSTDIR\EXPORT-LOCAL-FILES.cmd"
  Delete "$INSTDIR\ExtensionId.txt"
  Delete "$INSTDIR\bridge\TheOrg.Bridge.exe"
  RMDir "$INSTDIR\bridge"
  RMDir /r "$INSTDIR\chrome-extension"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR\Local-Files"
  RMDir "$INSTDIR"
  DetailPrint "Original workspaces and exported local files have been preserved."
SectionEnd

