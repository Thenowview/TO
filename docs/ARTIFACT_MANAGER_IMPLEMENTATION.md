# TheOrg Artifact Manager — implementation and acceptance audit

**Scope:** Chrome-side manually imported agent files and the local Windows Native Messaging controller.  
**Development PR:** https://github.com/faisalwrokksa-hub/TO/pull/2  
**CI evidence:** https://github.com/faisalwrokksa-hub/TO/actions/runs/42807867287  
**Status:** Windows controller and JS syntax checks passed on GitHub Actions. Clean-user installation, live AI-provider automation, content QA and imported legacy-archive compatibility remain **unverified**.

## Workflow and trust boundary

1. The owner creates a local work order from the Supervisor page.
2. The owner obtains a structured plan through an **authorized manual consultation** with an external AI chat, then pastes the plan into TheOrg.
3. The Supervisor validates the plan structure and requires review before specialist tabs open.
4. Agents consult AI providers in separate, TheOrg-owned, task-scoped Chrome tabs. TheOrg does **not** scrape chats, reuse ChatGPT plugin tokens or bypass provider controls.
5. After a permitted AI chat provides a file, an operator downloads the file normally and selects it in the **Deliveries → Import artifact** form.
6. The Chrome extension reads the explicitly selected file and sends its base64 contents to the registered Windows Native Messaging host. Import size is **250 KiB per file** in this first implementation.
7. The host binds the artifact to its company, work order, and assigned agent. It stores actual bytes under a randomly generated artifact ID, preserving the original filename as metadata only.
8. On each import, the host records a version for that agent+filename, SHA-256, length, source-provider label, source reference, creation time and intake status.
9. The owner can list, verify and download local imported artifacts. Integrity verification re-reads the stored bytes; it does **not** establish content accuracy, macro safety, malware safety or task completion.
10. An agent's handoff is saved before its tracked tabs close.
11. The Supervisor may only report **pending independent verification** when all agents submitted and the files have passed integrity checks. Actual semantic QA and business acceptance are not implemented in this release.

All extension data and files remain local unless the human explicitly shares them with an AI provider. External provider privacy terms apply to any data pasted into their sites.

## Implemented source paths

| Path | Change |
|---|---|
| \`engine/bridge/ArtifactStore.cs\` | Validated intake, per-company storage, immutable versions, metadata and byte checks |
| \`engine/bridge/Program.cs\` | Native commands: import_artifact, list_artifacts, verify_artifact, read_artifact; regression self-test |
| \`apps/chrome-extension/task-manager.js\` | Agent-assigned intake, artifact list/read/check, Supervisor review gate |
| \`apps/chrome-extension/background.js\` | Extension message router to the Windows controller |
| \`apps/chrome-extension/home.html\` | Local file-intake form and Deliveries region |
| \`apps/chrome-extension/home.js\` | Supervisor UI, actual file list, byte-download and audit actions |
| \`apps/chrome-extension/home.css\` | Responsive visual system |
| \`tools/install-native-host.ps1\` | User-scoped registry and allowed Chrome extension ID |
| \`.github/workflows/bridge-ci.yml\` | JS checks, Windows compile, controller self-test and unsigned Windows candidate |

## Security and release boundaries

- No AI-generated code is executed from an imported file.
- Imported files are **untrusted** and not auto-approved, published, opened by privileged tools or uploaded to cloud storage.
- The host accepts only known extensions and safe basename characters and rejects path traversal.
- Native messages are bounded to 1 MiB; file import is limited to 250 KiB.
- The Chrome manifest has no host-wide webpage scraping permissions.
- The installation helper registers only the extension ID supplied by the owner; use the ID from \`chrome://extensions\`.
- The browser closes only TheOrg-created tabs tracked in the same task group after saving the specialist handoff.
- Demo plan.md and work-product.md are distinct from externally sourced agent artifacts.

## Historical source compatibility

The original \`TheOrg.zip\` / \`TheOrg(2).zip\` and sidebar archives have **not** been extracted into this GitHub repository. Their previously documented v0.6 local document generators and SQLite work-order workflows may be reused **after** file-by-file inspection and license/secrets audit. This development branch contains a new .NET bridge, but it does not claim to replace or fully merge that older source.

## Verified checks

GitHub Actions run https://github.com/faisalwrokksa-hub/TO/actions/runs/42807867287 reported:
- JS syntax, manifest and JSON configuration: **pass**
- Windows \`dotnet build\`: **pass, 0 warnings, 0 errors**
- Windows \`--self-test\`: **pass**, with artifact import, versioning, byte-roundtrip, tamper detection and tenant isolation
- Self-contained Win-x64 controller publish: **pass**
- The uploaded build is an **unsigned bridge candidate**, not an audited one-click TheOrg installer.

A separate direct simulated Chrome workflow check passed 9 steps: plan interpretation, work order creation, Supervisor tab grouping, planning handoff/closing, approval, specialist grouping, file intake, handoff/closing, and blocked completion when an imported file was unverified.

## Remaining acceptance gates

- [ ] Import and audit original TheOrg/sidebar source and preserve legacy generators
- [ ] Validate the extension and Native Messaging on an actual Chrome Stable + Windows 11 installation
- [ ] Implement approved website-based file-download routing where supported (manual import is operational design only)
- [ ] Add streamed transfer for files above 250 KiB
- [ ] Implement malware scanning and content-format validation in a safe sandbox
- [ ] Implement independent semantic QA against each specialist's acceptance criteria
- [ ] Test rollback/version restore, storage quotas and crash recovery for the full pipeline
- [ ] Validate signed installation/uninstallation and production-security boundaries

**Release decision:** development candidate accepted for code review; **not production-ready**.
