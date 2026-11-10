# TheOrg Browser — offline Chromium Windows build

**Channel:** unsigned developer preview / Windows 10–11 x64  
**Upstream browser:** official Chromium snapshot, not Google Chrome or Chrome for Testing  
**Source:** https://www.chromium.org/getting-involved/download-chromium/  
**Source project:** https://chromium.googlesource.com/chromium/src/  
**TheOrg project:** https://github.com/faisalwrokksa-hub/TO

## Installing

1. Open the successful **TheOrg Offline Chromium Browser** workflow run on GitHub Actions.
2. Download the artifact named **TheOrg-Browser-Chromium-Win-x64-unsigned** and extract its ZIP.
3. Compare the installer SHA-256 with the bundled SHA256SUMS.txt (PowerShell: Get-FileHash).
4. Run **TheOrg-Browser-Chromium-Win-x64-unsigned.exe**. Installation is per-user and does **not** download the browser, extension, or local controller.
5. Start **TheOrg Browser** from the desktop/Start menu. The isolated profile is stored at %LOCALAPPDATA%\TheOrg\ChromiumProfile; workspaces remain at %LOCALAPPDATA%\TheOrg\workspace.
6. In the TheOrg Supervisor, select **Check connection**. Try the synthetic/local-only workflow, then review its output files before trusting them.

## Independence and limitations

- The installer contains a complete Chromium snapshot, TheOrg Supervisor MV3 extension and a self-contained .NET Windows controller.
- TheOrg's launcher is branded and its profile is independent. Chromium's own executable name, About dialog, internal resources and default settings are **not yet rebuilt under TheOrg branding**. That would require a custom branded Chromium source build.
- There is **no browser download, network updater or external component fetch during setup**. Web browsing and online AI integrations naturally require internet. Real Ollama-based AI planning requires Ollama and model weights installed separately.
- The installed Chromium snapshot **does not automatically receive security updates**. Treat this as a technical preview; rebuild regularly from a supported, patched source revision before real business use.
- Existing local AI supports bounded reviewed tasks, artifacts and synthetic workflows. It does **not** provide unrestricted website actions, independent multi-agent autonomy, or production-certified account integration.
- The executable is unsigned; GitHub Actions package tests and hashes do **not** constitute malware certification or validation on the owner's own Windows PC.
- Native Messaging is registered under **HKCU\Software\Chromium\NativeMessagingHosts\com.theorg.bridge**, restricting access to the actual extension ID. Existing Google Chrome registration is not changed.
- Existing Chrome accounts, cookies, session tokens and passwords are **not** copied.
- The browser and local controller are installed under %LOCALAPPDATA%\Programs\TheOrg Browser. The uninstaller removes that software and its Chromium Native Messaging registration, but retains saved profile and workspace data.

## Building / testing

Repository workflow: .github/workflows/chromium-browser-ci.yml
Windows NSIS setup: tools/TheOrgChromium.nsi
Windows launch: tools/TheOrgChromium-Start.ps1
Native host: tools/install-chromium-host.ps1

The Windows workflow downloads official Chromium during **build time**, confirms ProductName is Chromium, captures SHA-256 provenance, compiles TheOrg's self-contained bridge and packages all components inside one installer. It runs silent install/uninstall and Native Messaging smoke tests. Only distribute after reviewing the workflow artifacts and confirming the build is green.

## Remaining release gates

- Verify actual browser GUI, navigation, downloads, bookmarks, extension loading and bridge handshake on Windows 11 hardware.
- Complete independent malware/security screening, licensing review and publication rights.
- Arrange trusted code signing and repeatable, regularly updated Chromium release builds.
- For true full rebranding, compile a maintained Chromium source fork with TheOrg-specific executable metadata, resources, icon, settings and About screens.
- Add first-party bookmark import and explicit user-approved profile migration (never silently copy credentials).
