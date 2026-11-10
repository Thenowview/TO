# TheOrg — Chrome-native AI operating workspace

**Status:** Source migration in progress. This repository is a private development workspace; it is not yet a verified Windows release.

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

See [Artifact Manager implementation and acceptance audit](docs/ARTIFACT_MANAGER_IMPLEMENTATION.md).

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

**Important limitations:** The setup has not been manually verified on the owner's Windows/Chrome installation. The bridge candidate is unsigned and is not a complete TheOrg desktop installer. File imports are limited to 250 KiB per file; files are treated as untrusted until independent content QA. Never load or execute unknown AI-generated code. Do not import confidential files into AI providers without authorization.


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
