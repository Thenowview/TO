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
6. The Chrome extension reads the explicitly selected file and sends its base64 contents to the registered Windows Native Messaging host. Import uses **128 KiB chunks** for files up to **32 MiB**. Upload sessions have a 24-hour expiry, a stored byte offset and SHA-256 verification. The previous 250 KiB single-message path remains available for legacy callers.
7. The host binds the artifact to its company, work order, and assigned agent. It stores actual bytes under a randomly generated artifact ID, preserving the original filename as metadata only.
8. On each import, the host records a version for that agent+filename, SHA-256, length, source-provider label, source reference, creation time and intake status.
9. The owner can list, verify and download local imported artifacts. Integrity verification re-reads the stored bytes; separate structural checks inspect format signatures, UTF-8/JSON validity, Office container structure, macro indicators and ZIP expansion limits. **These checks are not malware scanning, semantic verification, or proof of task completion.**
10. An agent's handoff is saved before its tracked tabs close.
11. The Supervisor may only report **pending independent verification** when all agents submitted and the files have passed integrity checks. Actual semantic QA and business acceptance are not implemented in this release.

All extension data and files remain local unless the human explicitly shares them with an AI provider. External provider privacy terms apply to any data pasted into their sites.

## Implemented source paths

| Path | Change |
|---|---|
| \`engine/bridge/ArtifactStore.cs\` | Validated intake, per-company storage, immutable versions, metadata and byte checks |
| \`engine/bridge/Program.cs\` | Native commands for intake, multi-chunk transfer, list, checksum/structure checks and download; regression self-test |
| \`engine/bridge/ArtifactTransfers.cs\` | Recoverable 32 MiB staged transfer with offset, size and SHA-256 checks; expired-session cleanup |
| \`engine/bridge/ArtifactInspection.cs\` | Bounded format signature and archive inspection, not a malware scanner |
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
- Native messages are bounded to 1 MiB by our host; individual transfer chunks are at most 128 KiB, and per-file transfers are capped at 32 MiB. Chrome's own directional limits differ. Each staged transfer is tied to one company, order, random ID and access token.
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

## Release branch additions (November 2026)

- Windows upload controller now uses `begin_artifact_upload`, `append_artifact_chunk`, `upload_status`, `complete_artifact_upload` and `cancel_artifact_upload`.
- Browser download uses `read_artifact_chunk`, with a final browser-side SHA-256 comparison before writing the user's downloaded file.
- `chrome.storage.session` holds an in-progress transfer token while Chrome remains open; a Chrome restart clears it, so full browser-restart recovery is **not** complete.
- `ArtifactInspection` reports structural indicators only. It does not guarantee the file is harmless.
- `tools/TheOrgPreview.nsi` and the NSIS workflow aim to create an unsigned one-file Windows developer-preview installer. Installing and connecting the Chrome extension remains an authorized user step.

## Remaining acceptance gates

- [ ] Import and audit original TheOrg/sidebar source and preserve legacy generators
- [ ] Validate the extension and Native Messaging on an actual Chrome Stable + Windows 11 installation
- [ ] Implement approved website-based file-download routing where supported (manual import is operational design only)
- [x] Add recoverable 32 MiB chunked file transfer and verified download (unit tests passed; browser integration remains untested)
- [x] Add bounded format and container checks (unit-tested; **not** a malware scan)
- [ ] Integrate an independent malware scanner and safe preview sandbox
- [ ] Implement independent semantic QA against each specialist's acceptance criteria
- [ ] Test end-to-end browser restart recovery, version restore, storage quotas and on-device crash behavior (recovered host-process transfer covered by self-tests)
- [ ] Confirm preview installer built and validate silent install/uninstall in Windows CI; signed production installation is still pending

**Release decision:** development candidate accepted for code review; **not production-ready**.
