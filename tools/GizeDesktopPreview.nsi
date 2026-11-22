Unicode True
!include "MUI2.nsh"
!include "x64.nsh"
Name "GIZE AI Desktop Preview"
OutFile "..\out\installer\GIZE-Desktop-Preview-x64-unsigned.exe"
InstallDir "$LOCALAPPDATA\Programs\GIZE"
RequestExecutionLevel user
ShowInstDetails show
ShowUninstDetails show
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
Function .onInit
  StrCmp $INSTDIR "$LOCALAPPDATA\Programs\GIZE" +3
    MessageBox MB_OK "Install GIZE in its dedicated per-user program folder."
    Abort
FunctionEnd
Section "GIZE desktop"
  SetShellVarContext current
  SetOutPath "$INSTDIR"
  File /r "..\out\desktop\*.*"
  WriteUninstaller "$INSTDIR\Uninstall-GIZE.exe"
  CreateDirectory "$SMPROGRAMS\GIZE"
  CreateShortcut "$SMPROGRAMS\GIZE\GIZE AI.lnk" "$INSTDIR\Gize.Desktop.exe"
  CreateShortcut "$DESKTOP\GIZE AI.lnk" "$INSTDIR\Gize.Desktop.exe"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\GizeDesktopPreview" "DisplayName" "GIZE AI Desktop Preview"
  WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\GizeDesktopPreview" "UninstallString" '$\"$INSTDIR\Uninstall-GIZE.exe$\"'
SectionEnd
Section "Uninstall"
  SetShellVarContext current
  Delete "$DESKTOP\GIZE AI.lnk"
  Delete "$SMPROGRAMS\GIZE\GIZE AI.lnk"
  RMDir "$SMPROGRAMS\GIZE"
  ; Delete only this install's packaged assets. Preserve all job data and browser profiles.
  RMDir /r "$INSTDIR\assets"
  Delete "$INSTDIR\*.dll"
  Delete "$INSTDIR\*.pdb"
  Delete "$INSTDIR\*.json"
  Delete "$INSTDIR\Gize.Desktop.exe"
  Delete "$INSTDIR\TheOrg.Bridge.exe"
  Delete "$INSTDIR\Uninstall-GIZE.exe"
  RMDir "$INSTDIR"
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\GizeDesktopPreview"
SectionEnd
