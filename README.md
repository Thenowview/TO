# TheOrg — Chrome-native AI operating workspace

**Status:** Developer-preview source merged to `main`; Windows installer and bridge have passed automated CI checks. This is **not** a production release or a verified owner-PC installation. Legacy source migration and live provider automation remain incomplete.

## Product objective

TheOrg is a local-first Windows application coordinated from Chrome Stable. The user gives one order, a supervisor obtains a plan from an authorized AI session, specialist agents perform bounded tasks with approved browser/desktop tools, and TheOrg verifies resulting files before delivery.

**Architecture:** dedicated Chrome profile → Manifest V3 extension (side panel and full tab) → authenticated Native Messaging bridge → bundled Windows execution engine → SQLite and per-company file workspaces. Online storage/email/calendar integrations remain optional and permission-scoped. Local tasks must remain usable offline.


## Development branch: Chrome Supervisor + Windows artifact bridge

The \`feat/chrome-windows-native-bridge\` branch contains a **development candidate**:

- Chrome MV3 Supervisor dashboard and AI provider directory (provider chats are **manual handoffs**, not automated integrations)
- Structured planning proposals, owner review, tracked specialist tabs and text handoffs
- 12 permanent agent-profile definitions and a future Plugin Gateway target registry
- A .NET 8 Native Messaging host with a bounded, company-scoped file import API
- Actual imported artifact metadata, file versions, SHA-256 verification and local download support
- Local deterministic demo files, separate from real AI-chat artifacts
- Chunked manual import and verified download for files up to **32 MiB**; format-structure checks flag malformed PDFs, Office containers and potentially unsafe archives

See [Artifact Manager implementation and acceptance audit](docs/ARTIFACT_MANAGER_IMPLEMENTATION.md).

### Optional local agent execution preview (Ollama or synthetic)

The extension now includes an experimental local agent console. A saved text instruction can be converted into a validated plan using optional Ollama on 127.0.0.1:11434; the owner must approve before executing any tools. An independent model critique is advisory only. A SQLite job journal persists across Native Messaging processes. Real permitted actions include scoped text-note generation, system information, approved HTTPS tab navigation and a limited Notepad launcher. See the Windows operator guide. Full autonomous browser and desktop control are not implemented.

### One-file Windows developer-preview installer

The CI workflow also builds an **unsigned** NSIS installer containing the bridge and unpacked extension source. It is not code-signed or independently security certified.

1. Open [TheOrg GitHub Actions](https://github.com/faisalwrokksa-hub/TO/actions), select a successful **Chrome and Windows Bridge CI** run, and download the `TheOrg-DevPreview-Windows-x64-unsigned-installer` artifact.
2. Extract the artifact ZIP and run `TheOrg-DevPreview-Windows-x64-unsigned.exe` only if you trust the source and build provenance.
3. Use the installed Start Menu shortcut **TheOrg → Connect Chrome extension** to see the required manual Chrome configuration. Keep the extension identity private to your profile.
4. The installer never connects an AI service or authorizes external actions on your behalf.

### Windows installation and local testing

1. Open the [Windows CI workflow](https://github.com/faisalwrokksa-hub/TO/actions) and download the **unsigned bridge candidate** from a successful run. Alternatively, with the .NET 8 SDK installed, run:

   \`\`\`powershell
   dotnet publish engine/bridge/TheOrg.Bridge.csproj -c Release -r win-x64 --self-contained true -p:PublishSingleFile=true -o out/bridge
   dotnet run --project engine/bridge/TheOrg.Bridge.csproj -c Release -- --self-test
   \`\`\`

2. In Chrome Stable, open \`chrome://extensions\`, enable **Developer mode**, choose **Load unpacked**, and select \`apps/chrome-extension\`.
3. Copy the extension ID displayed on that page.
4. Register the native bridge under your current Windows user account:

   \`\`\`powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\install-native-host.ps1 -ExtensionId "<32-character Chrome extension ID>" -ExecutablePath ".\out\bridge\TheOrg.Bridge.exe"
   \`\`\`

   Use the real \`.exe\` path. If you downloaded the GitHub Actions artifact, extract it first and point to that executable.

5. Click the TheOrg extension icon to open the full-tab Supervisor home page. Choose **Check connection**.
6. Create a demo order, manually consult an authorized AI provider, paste a structured plan, approve agent assignments, and use **Deliveries** to import a small local file for verification.
7. To unregister the host without deleting workspaces:

   \`\`\`powershell
   powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\uninstall-native-host.ps1
   \`\`\`

**Important limitations:** The setup has not been manually verified on the owner's Windows/Chrome installation. The bridge and developer-preview installer candidates are unsigned. The installer packages the controller and Chrome extension, but the extension still requires Chrome's authorized **Load unpacked** and the user-scoped Native Messaging registration. File imports support up to 32 MiB via 128 KiB chunks; files remain untrusted until independent content QA. Never load or execute unknown AI-generated code. Do not import confidential files into AI providers without authorization.


## Source preservation

The historical sources **TheOrg(2).zip** and **Theorg's.zip** are owner-supplied archives and **have not yet been imported into this repository**. Preserve the original sidebar and existing Python workflow, storage, document tools, and tests before refactoring. Do not claim that the archives were audited from this repository until their extracted source is committed and inventoried.

Recommended directories after migration:

- `legacy/original-sidebar/` — original sidebar source, unmodified; only after security review
- `legacy/theorg-v0.6/` — existing local app modules, when identified and safely extracted
- `apps/chrome-extension/` — Chrome UI and permissions
- `apps/office-workspace/` — supervisor/employee/deliveries UI
- `engine/` — local Windows bridge, supervisor and execution
- `connectors/` — Google and Microsoft integrations
- `skills/` — approved, versioned procedures
- `tests/` — regression and integration tests
- `docs/` — architecture, inventory and release evidence

This tree is a target, **not** a statement that its modules already exist.

## Release evidence and boundaries

The [release audit](docs/RELEASE_AUDIT_2026-11-10.md) distinguishes automated Windows build/installation checks from real end-user Chrome acceptance. The installer CI additionally checks that user-scoped Native Messaging registration creates a valid manifest pointing to the installed executable and restricts `allowed_origins` to one explicit Chrome extension ID. This test uses a synthetic ID and does not prove browser connectivity on the owner's machine.

To audit a build, open [GitHub Actions](https://github.com/faisalwrokksa-hub/TO/actions), verify both jobs are green for the **same commit**, and download only the unsigned developer-preview artifact from that run. Never interpret a green build as production readiness. For actual Windows acceptance, load the unpacked extension in Chrome Stable, register its real extension ID, use **Check connection**, and independently verify a complete test order and safe file import. Record the environment and results before signing off.

## First action

Follow [docs/IMPORT_EXISTING_SOURCE.md](docs/IMPORT_EXISTING_SOURCE.md) to import *extracted, sanitized source* from both owner archives. Do not upload the original 260 MB ZIP, browser profiles, tokens, secrets, binary artifacts or dependency caches.

## Required acceptance checks

1. Complete source inventory and SHA-256 checksums.
2. Existing v0.6 functionality retained; historical test record is not a new pass.
3. Chrome extension exchanges verified messages with a registered Windows native host.
4. Real supervisor → specialist → file workflow, with permitted provider integration and evidence.
5. Offline task recovery, file integrity and permission controls.
6. Clean Windows 11 installation, restart and uninstall; release status based on actual test results.

**Security:** Never automate unauthorized AI-provider access or bypass CAPTCHAs, login protections or message quotas. Human approval is mandatory for consequential actions. No production operations are authorized by this repository setup.
