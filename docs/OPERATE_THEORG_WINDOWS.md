# START HERE — TheOrg Windows Developer Preview

**Build:** GitHub Actions `TheOrg Chrome and Windows Bridge CI`. The ZIP's `SHA256SUMS.txt` records the exact source commit used for the downloaded installer.

**This is an unsigned, experimental Windows developer preview, not a certified production release.** Do not use it for sensitive customer data, payments, production accounts, or unattended tasks. The built-in demo does not run autonomous AI providers. You do **not** need TinyFish or paid tools to try the local preview.

## What is inside this ZIP?

- `TheOrg-DevPreview-Windows-x64-unsigned.exe` — the actual Windows installer (64-bit).
- `SHA256SUMS.txt` — SHA-256 hashes and source commit.
- `START_HERE.md` — this guide.
- `VERIFY.ps1` — read-only package and installed-file checks. It does not install or configure Chrome.

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

## 2. Install the preview

Double-click `TheOrg-DevPreview-Windows-x64-unsigned.exe`, read the unsigned-app warning, and install to the default **current-user** folder:

```text
%LOCALAPPDATA%\Programs\TheOrg
```

No admin privilege should be required. The application installs a local Native Messaging bridge and unpacked Chrome extension files. It does not silently install a Chrome extension.

## 3. Connect Chrome Stable

1. In Chrome, open `chrome://extensions`.
2. Turn **Developer mode** on. Select **Load unpacked**.
3. Select the **folder**, not the ZIP or a single file:

   ```text
   %LOCALAPPDATA%\Programs\TheOrg\chrome-extension
   ```

4. Find the **TheOrg — Supervisor Workspace** extension and copy its 32-letter Extension ID.
5. In Windows **Start → TheOrg → Connect Chrome extension**, paste this ID into the registration script. This registers only that specific extension for the local Windows bridge under the current user.
6. Fully close and reopen Chrome if the connection is not immediately detected.
7. Click the TheOrg extension icon to open its Supervisor tab; select **Check connection**. The app should report the bridge connection.

Optional read-only verification after Chrome registration (substitute the real ID):

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File '.\VERIFY.ps1' -CheckInstalled -ExtensionId 'abcdefghijklmnopabcdefghijklmnop'
```

**Important:** The sample ID shown above is **not** your extension ID. Paste the real ID from `chrome://extensions`.

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
| “Check connection” fails | Confirm extension is loaded unpacked in Chrome Stable, the 32-letter ID was entered correctly, and Chrome was restarted. Run the installed check below. |
| Windows bridge missing | Look for `%LOCALAPPDATA%\Programs\TheOrg\TheOrg.Bridge.exe`. Reinstall from the verified CI artifact if missing. |
| Native Messaging host absent | Rerun **Start → TheOrg → Connect Chrome extension** with the actual extension ID; this is a user-scoped registration. |
| Extension ID changed | Re-register the host with the new exact ID. The old ID does not automatically retain access. |
| Installer blocked by Windows | This preview is unsigned. Verify provenance and checksum; don't turn off system protection globally. A signed production release has not been created. |
| AI task not automatically executed | Expected: live AI-provider execution is not connected. Only approved manual handoffs are supported. |
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


## 8. Optional Ollama planning and local tool execution — experimental preview

This feature runs on the owner's own Windows PC through the existing extension and Native Messaging bridge. It is not production-ready or a hosted web agent.

**Real AI planning (optional):**
1. Install Ollama for Windows from its official website.
2. In a Windows terminal run the command: ollama pull qwen3:4b. The model downloads separately; no model weights are bundled in TheOrg's installer.
3. Make sure Ollama is listening on its standard loopback address 127.0.0.1:11434; run ollama serve if needed. TheOrg never sends data to a public inference endpoint.
4. In the Chrome Supervisor submit a synthetic work order through the existing text box, e.g. "Create a short synthetic checklist and list the files you created."
5. Under "Execute reviewed instructions on this PC", choose Ollama, model qwen3:4b, and an exact list of approved HTTPS hostnames. Click "Plan selected work order". If Ollama is unavailable, the request fails explicitly; it does not silently pretend to use AI.
6. Read the entire proposed plan, including tool inputs, then approve it. Click "Execute next approved tool step" to run exactly one restricted step at a time.
7. Run evidence and AI QA. This checks real file hashes and can request a skeptical separate model critique. The verdict remains human_review_required, not independent business certification.

**No local AI model required for initial tests:** Select "Synthetic local file test" for real, scoped local note generation and file listing, but no AI. "Synthetic Chrome navigation test" opens one approved HTTPS host (default example.com) in Chrome after approval; it does not inspect web page contents or automate clicks. "Synthetic Notepad launch test" starts notepad.exe on Windows; it does not automate general desktop GUI interactions.

**Persistence:** jobs, events, approval decisions, cancellation, queue state and scoped user memory are in %LOCALAPPDATA%\TheOrg\workspace\agent-jobs.sqlite. Generated notes reside in %LOCALAPPDATA%\TheOrg\workspace\companies\<company>\orders\<order-id>\agent_outputs. Active steps interrupted mid-execution are blocked for investigation rather than silently replayed. Queued steps are available after restarting the extension. There is no continuously running worker.

**Restrictions:** no arbitrary shell, unrestricted Windows automation, arbitrary filesystem access, clipboard scraping, account access, browser DOM controls, form submission or automated deployment. Model plans are untrusted suggestions and require explicit approval. Browser hostnames must match the exact user-approved list. Never use sensitive customer data in this unsigned preview.

**Roadmap status:** This adds a scoped P0 slice (Ollama planner, bounded action tools, durable job state, typed plans and evidence checks) and limited P1 browser/Windows demonstrations. It does not implement full Playwright/CDP automation, unrestricted desktop automation, parallel batch scheduling, general MCP protocol services or skill-evolution pipelines. No existing production release gate is closed without independent evidence.
