# TheOrg — one Windows EXE using existing Google Chrome

This build continues the user-supplied audited Windows installer (source commit
beda43b4288c176783ad9f9ffadafd110aa1e37f). The earlier package included
a second Chrome for Testing browser. That original file remains unchanged.

## What the one-file installer does

1. Download the single TheOrg-OneFile-ExistingChrome-Win-x64-unsigned.exe from
   a passing GitHub Actions run, and compare its SHA256 against that run's log.
2. Run it on Windows 10/11 x64 with Google Chrome already installed.
3. It installs its self-contained Windows local controller and packaged extension,
   registers the exact fixed Chrome Native Messaging extension ID, creates a desktop
   shortcut and local-file tools, and opens Chrome's Extensions page and a setup guide.
4. ONE manual browser approval remains mandatory: in chrome://extensions turn on
   Developer mode, select Load unpacked, and choose the chrome-extension folder
   inside the location opened by Windows Explorer. Do NOT choose its parent.
5. Double-click TheOrg - Chrome and choose Check connection. No separate PowerShell
   script, extension ID entry, Chrome download, or Ollama installation is required.
6. Generated agent notes and SQLite state are stored in
   %LOCALAPPDATA%\TheOrg\workspace. Start menu links open that workspace or copy
   generated notes to the installed Local-Files directory.

## Constraints

The EXE is unsigned and developer preview only, not production approved.
Chrome's user approval for an unpacked extension cannot be bypassed.
The manifest has a public key for ID consistency; it is not an authentication key
or evidence of extension signing. Existing user files remain on uninstall, while
the program and Native Messaging registration are removed only when owned by this
installation. Old TheOrg Chrome extension copies may need disabling.
Real local AI planning requires Ollama installed separately; the synthetic tests
do not require Ollama. Real user-device Chrome acceptance is still required.
