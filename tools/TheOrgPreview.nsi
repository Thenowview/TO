!include "MUI2.nsh"

Name "TheOrg Workspace Developer Preview"
OutFile "..\out\installer\TheOrg-DevPreview-Windows-x64-unsigned.exe"
InstallDir "$LOCALAPPDATA\Programs\TheOrg"
RequestExecutionLevel user
Unicode true
SetCompressor zlib
ShowInstDetails show
ShowUninstDetails show

!define MUI_ABORTWARNING
!define MUI_WELCOMEPAGE_TITLE "Welcome to TheOrg Developer Preview"
!define MUI_WELCOMEPAGE_TEXT "Installs a dedicated browser, TheOrg Supervisor and its local agent engine.$\r$\n$\r$\nTheOrg starts from your desktop or Start menu with its own isolated profile.$\r$\n$\r$\nUnsigned developer preview. Browser updates are manual; use synthetic test data."
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"

Section "TheOrg local controller and Chrome extension" SecMain
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  File "..\out\bridge\TheOrg.Bridge.exe"
  File /oname=install-native-host.ps1 "..\tools\install-native-host.ps1"
  File /oname=uninstall-native-host.ps1 "..\tools\uninstall-native-host.ps1"
  File /oname=configure-chrome.ps1 "..\tools\configure-chrome.ps1"
  File /oname=TheOrg-Start.ps1 "..\tools\TheOrg-Start.ps1"
  File /oname=BROWSER_SOURCE.txt "..\out\browser\BROWSER_SOURCE.txt"

  SetOutPath "$INSTDIR\browser"
  File /r "..\out\browser\chrome-win64\*.*"

  SetOutPath "$INSTDIR\chrome-extension"
  File /r "..\apps\chrome-extension\*.*"

  CreateDirectory "$SMPROGRAMS\TheOrg"
  CreateShortCut "$SMPROGRAMS\TheOrg\TheOrg Workspace.lnk" \
    "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" \
    '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$INSTDIR\TheOrg-Start.ps1"' \
    "$INSTDIR\browser\chrome.exe" 0
  CreateShortCut "$DESKTOP\TheOrg Workspace.lnk" \
    "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" \
    '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$INSTDIR\TheOrg-Start.ps1"' \
    "$INSTDIR\browser\chrome.exe" 0
  CreateShortCut "$SMPROGRAMS\TheOrg\Connect Chrome extension.lnk" \
    "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" \
    '-NoProfile -ExecutionPolicy Bypass -File "$INSTDIR\configure-chrome.ps1"'
  CreateShortCut "$SMPROGRAMS\TheOrg\Windows bridge self-test.lnk" \
    "$INSTDIR\TheOrg.Bridge.exe" "--self-test"

  WriteUninstaller "$INSTDIR\Uninstall.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TheOrgDevPreview" \
    "DisplayName" "TheOrg Developer Preview (unsigned)"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TheOrgDevPreview" \
    "UninstallString" '"$INSTDIR\Uninstall.exe"'
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TheOrgDevPreview" \
    "InstallLocation" "$INSTDIR"
  WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TheOrgDevPreview" \
    "NoModify" 1

  ; Only interactive installation launches the dedicated TheOrg browser.
  IfSilent skipBrowserLaunch
  ExecShell "open" "$SYSDIR\WindowsPowerShell\v1.0\powershell.exe" \
    '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "$INSTDIR\TheOrg-Start.ps1"'
  skipBrowserLaunch:
SectionEnd

Section "Uninstall"
  SetShellVarContext current
  DeleteRegKey HKCU "Software\Google\Chrome\NativeMessagingHosts\com.theorg.bridge"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\TheOrgDevPreview"
  Delete "$DESKTOP\TheOrg Workspace.lnk"
  Delete "$SMPROGRAMS\TheOrg\TheOrg Workspace.lnk"
  Delete "$SMPROGRAMS\TheOrg\Connect Chrome extension.lnk"
  Delete "$SMPROGRAMS\TheOrg\Windows bridge self-test.lnk"
  RMDir "$SMPROGRAMS\TheOrg"

  Delete "$INSTDIR\TheOrg.Bridge.exe"
  Delete "$INSTDIR\install-native-host.ps1"
  Delete "$INSTDIR\uninstall-native-host.ps1"
  Delete "$INSTDIR\configure-chrome.ps1"
  Delete "$INSTDIR\TheOrg-Start.ps1"
  Delete "$INSTDIR\BROWSER_SOURCE.txt"
  RMDir /r "$INSTDIR\browser"
  RMDir /r "$INSTDIR\chrome-extension"
  Delete "$INSTDIR\Uninstall.exe"
  RMDir "$INSTDIR"
  DetailPrint "TheOrg BrowserProfile, workspaces and company data were retained under LocalAppData."
SectionEnd
