# START HERE — TheOrg Windows Developer Preview

**Build:** GitHub Actions `TheOrg Chrome and Windows Bridge CI`. The ZIP's `SHA256SUMS.txt` records the exact source commit used for the downloaded installer.

**This is an unsigned, experimental Windows developer preview, not a certified production release.** Do not use it for sensitive customer data, payments, production accounts, or unattended tasks. Optional Ollama planning and bounded approved tool execution are available in this preview; they require a working local model and explicit tool approval. You do **not** need TinyFish or paid tools. A pinned upstream Chrome for Testing browser is bundled and does not auto-update.

## What is inside this ZIP?

- `TheOrg-DevPreview-Windows-x64-unsigned.exe` — the actual Windows installer (64-bit).
- `SHA256SUMS.txt` — SHA-256 hashes and source commit.
- `START_HERE.md` — this guide.
- `VERIFY.ps1` — read-only package and installed-file checks.
- `BROWSER_SOURCE.txt` — official pinned browser version, download provenance and SHA-256.

This ZIP deliberately excludes the original historical source archives, real login sessions, API keys, build caches, and executable scripts downloaded from AI providers.

## 1. Verify the package before installation

Use Windows 11 x64, Chrome Stable, and a local Windows account permitted to install user applications. Extract the ZIP to an ordinary folder, such as `Downloads\TheOrgPreview`.

From **PowerShell** opened in the extracted folder:

```powershell
Get-FileHash '.\TheOrg-DevPreview-Windows-x64-unsigned.exe' -Algorithm SHA256
Get-Content '.\SHA256SUMS.txt'
powershell -NoProfile -ExecutionPolicy Bypass -File '.\VERIFY.ps1'
```

The installer SHA-256 must equal its line in `SHA256SUMS.txt`; `VERIFY.ps1` should report `PASS`. Checksums only detect file mismatch relative to that manifest; they do **not** prove the code is malware-free or signed. Only download the bundle from a successful workflow run in the official repository: https://github.com/faisalwrokksa-hub/TO/actions

If any file is missing or a hash differs, **stop** and download a new artifact. Do not bypass Windows security warnings if you cannot verify and trust the unsigned build.

## 2. One-click installation — dedicated TheOrg browser

This preview EXE installs the Windows agent controller, extension and an **unmodified, official Chrome for Testing browser**. It creates **TheOrg Workspace** desktop and Start menu shortcuts and uses an isolated browser profile under `%LOCALAPPDATA%\TheOrg\BrowserProfile`. Your normal Chrome profiles and cookies are never copied or modified.

1. Verify the extracted ZIP by running `powershell -NoProfile -ExecutionPolicy Bypass -File '.\VERIFY.ps1'` from the extracted folder. This applies only to this process; it does not change your system-wide policy.
2. Install `TheOrg-DevPreview-Windows-x64-unsigned.exe` for the current Windows user.
3. The interactive installer opens TheOrg automatically. You can also double-click **TheOrg Workspace** on your desktop.
4. At first launch, the launcher loads the bundled extension into its dedicated browser, discovers the actual extension ID from the profile and registers the Windows native host for precisely that ID.
5. The launcher opens the Supervisor. Choose **Check connection** and confirm the local controller responds.
6. To test actual AI-generated planning, install Ollama and a model separately. Neither is silently installed or downloaded by this EXE.
7. For a synthetic file-only plan, use **Run approved local-only steps** after reviewing and approving the plan. This executes up to five eligible local note/read-only actions; browser navigation and Notepad launch require separate clicks.

Normal testing does not require loading an unpacked extension by hand, copying an ID or editing the daily Chrome profile.

**Important:** Chrome for Testing does not auto-update. This unsigned package is for short-lived synthetic developer testing, **not general browsing, financial accounts or sensitive credentials**. Install a newer verified preview when browser security fixes are available. Review browser distribution/licensing before a public commercial release.

## 3. Troubleshooting the isolated profile

If no TheOrg window appears, inspect these installed files:

- `%LOCALAPPDATA%\Programs\TheOrg\TheOrg-Start.ps1`
- `%LOCALAPPDATA%\Programs\TheOrg\browser\chrome.exe`
- `%LOCALAPPDATA%\Programs\TheOrg\chrome-extension\manifest.json`

Run the launcher visibly to obtain an explicit error: `powershell -NoProfile -ExecutionPolicy Bypass -File "$env:LOCALAPPDATA\Programs\TheOrg\TheOrg-Start.ps1"`.

If the packaged browser, extension or bridge is absent, verify and reinstall from the official GitHub Actions artifact. The older Start menu **Connect Chrome extension** shortcut is retained for manual recovery using regular Chrome, not required for the dedicated browser.

The test browser has its own profile, no inherited Chrome logins, and no automatic privileged permissions. Agent tools remain approval-controlled.
## 4. First-use functional smoke test

Use only synthetic content. These are expected developer-preview behaviors, not production acceptance:

1. Open Supervisor and use **Check connection**. Record whether the local bridge responds. Do not treat the existence of the Chrome tab as a successful connection.
2. Create a demo order for a fake company, e.g. “Create a short sample research brief about an invented product and return an example checklist.” The local bridge creates **clearly labeled demo** work items; it has not researched the web.
3. Open a specialist handoff. AI-provider tabs are **manual**: consult a provider only if you explicitly authorize it, and paste back its structured response. Opening a tab is not execution.
4. Import a **small, non-sensitive** text/Markdown file through Deliveries. Confirm it appears under the expected company/order; verify content and checksum using the application's own verification view.
5. If possible, try reading the same artifact from another fake company ID: isolation should deny the request (the CI integration test checks this protocol behavior, but your real-browser test is separate).
6. Check actual filenames, source claims, timestamps and output. **Content QA is independent of file integrity.**

**Success requires:** real Chrome connection, one demo order, one synthetic file imported/read back, and no unexpected cross-company access. Write down errors rather than calling the whole system “ready.”

## 5. Troubleshooting

| Problem | What to inspect |
| --- | --- |
| “Check connection” fails | First rerun **TheOrg Workspace** to reconnect the isolated bundled browser. Open its `chrome://extensions` page and check for extension errors. If using regular Chrome instead, use **Connect Chrome extension** to register its actual 32-letter ID. |
| Windows bridge missing | Look for `%LOCALAPPDATA%\Programs\TheOrg\TheOrg.Bridge.exe`. Reinstall from the verified CI artifact if missing. |
| Native Messaging host absent | Rerun **Start → TheOrg → Connect Chrome extension** with the actual extension ID; this is a user-scoped registration. |
| Extension ID changed | Re-register the host with the new exact ID. The old ID does not automatically retain access. |
| Installer blocked by Windows | This preview is unsigned. Verify provenance and checksum; don't turn off system protection globally. A signed production release has not been created. |
| AI task not automatically executed | Ollama needs to be installed/running locally for model planning. Local tools are intentionally approval-controlled; provider chat tabs still require manual handoff. |
| Imported file reports structure verified but QA pending | Expected: SHA-256 and file-format checks do not prove semantic safety, malware absence or correctness. |

To inspect the native-host registration without editing it, run from PowerShell:

```powershell
Get-Item 'HKCU:\Software\Google\Chrome\NativeMessagingHosts\com.theorg.bridge' | Select-Object -ExpandProperty Property
Get-Content "$env:LOCALAPPDATA\TheOrg\NativeMessaging\com.theorg.bridge.json"
```

The manifest's `allowed_origins` must match your one real Chrome extension ID.

## 6. Uninstall / keep personal workspaces

Use **Windows Settings → Apps → Installed apps → TheOrg Developer Preview → Uninstall**, or launch:

```powershell
& "$env:LOCALAPPDATA\Programs\TheOrg\Uninstall.exe"
```

Then remove the unpacked TheOrg Chrome extension from `chrome://extensions` if you no longer need it. The installed binary and extension source should be removed by uninstall; company workspaces under `%LOCALAPPDATA%\TheOrg\workspace` are intentionally **preserved**. Do not delete those workspaces unless you intentionally want to lose locally saved demonstration work.

## What is and is not verified

- **Verified in GitHub CI:** JavaScript/supervisor mocked tests, .NET bridge self-tests, framed Native Messaging protocol and tenant isolation, installer creation, silent install/uninstall, test native-host registration, SHA256 manifest upload.
- **Not verified on your device:** Chrome Stable end-to-end registration, account-specific behavior, independent security review, real provider integrations, malware scanning and semantic QA, recovery from all failures, code signing.
- **Production release:** **NO-GO**. No configured production deployment destination exists; the installer is **unsigned** and local-only.

Further details in repository documents:
- https://github.com/faisalwrokksa-hub/TO/blob/main/docs/RELEASE_AUDIT_2026-11-10.md
- https://github.com/faisalwrokksa-hub/TO/blob/main/docs/PRODUCTION_READINESS_HANDOFF_2026-11-10.md


## 7. Optional Ollama planning and local tool execution — experimental preview

This feature runs on the owner's own Windows PC through the existing extension and Native Messaging bridge. It is not production-ready or a hosted web agent.

**Real AI planning (optional):**
1. Install Ollama for Windows from its official website.
2. In a Windows terminal run the command: ollama pull qwen3:4b. The model downloads separately; no model weights are bundled in TheOrg's installer.
3. Make sure Ollama is listening on its standard loopback address 127.0.0.1:11434; run ollama serve if needed. TheOrg never sends data to a public inference endpoint.
4. In the Chrome Supervisor submit a synthetic work order through the existing text box, e.g. "Create a short synthetic checklist and list the files you created."
5. Under "Execute reviewed instructions on this PC", choose Ollama, model qwen3:4b, and an exact list of approved HTTPS hostnames. Click "Plan selected work order". If Ollama is unavailable, the request fails explicitly; it does not silently pretend to use AI.
6. Read the entire proposed plan, including tool inputs, then approve it. Click **Execute next approved tool step** for one restricted action, or **Run approved local-only steps** for a bounded sequence of previously approved local note/read-only actions.
7. Run evidence and AI QA. This checks real file hashes and can request a skeptical separate model critique. The verdict remains human_review_required, not independent business certification.

**No local AI model required for initial tests:** Select "Synthetic local file test" for real, scoped local note generation and file listing, but no AI. "Synthetic Chrome navigation test" opens one approved HTTPS host (default example.com) in Chrome after approval; it does not inspect web page contents or automate clicks. "Synthetic Notepad launch test" starts notepad.exe on Windows; it does not automate general desktop GUI interactions.

**Persistence:** jobs, events, approval decisions, cancellation, queue state and scoped user memory are in %LOCALAPPDATA%\TheOrg\workspace\agent-jobs.sqlite. Generated notes reside in %LOCALAPPDATA%\TheOrg\workspace\companies\<company>\orders\<order-id>\agent_outputs. Active steps interrupted mid-execution are blocked for investigation rather than silently replayed. Queued steps are available after restarting the extension. There is no continuously running worker.

**Restrictions:** no arbitrary shell, unrestricted Windows automation, arbitrary filesystem access, clipboard scraping, account access, browser DOM controls, form submission or automated deployment. Model plans are untrusted suggestions and require explicit approval. Browser hostnames must match the exact user-approved list. Never use sensitive customer data in this unsigned preview.

**Roadmap status:** This adds a scoped P0 slice (Ollama planner, bounded action tools, durable job state, typed plans and evidence checks) and limited P1 browser/Windows demonstrations. It does not implement full Playwright/CDP automation, unrestricted desktop automation, parallel batch scheduling, general MCP protocol services or skill-evolution pipelines. No existing production release gate is closed without independent evidence.
