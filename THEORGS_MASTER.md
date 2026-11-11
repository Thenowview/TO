# TheOrg's Master — binding low-resource development specification

**Master artifact:** [TheOrg's Master.zip in the project Drive](https://drive.google.com/file/d/1qw6UaQpQHvhWlMK3YPqbbwBr5-vwIb25/view?usp=drivesdk). This ZIP is a compact **source-only v0.10 release-gates baseline**, not a completed Android APK, not a Windows executable, and not yet inclusive of the PR #18 LLM changes. Keep the master filename exactly **TheOrg's Master.zip** for successive reviewed releases.

**Implementation baseline:** Continue development in the current TheOrg repository. Maintain PR #17 release safeguards and this PR's feature branch. No parallel rewrite, no automatic merging, no production deployment, no paid services.

## Hardware budget and capability levels

- **Minimum target: 2 GB RAM, ARM64 Android tablets and basic x64 Windows computers, CPU only, no dedicated GPU or NPU.** A model-free core MUST open, persist data, and remain usable. This is not a claim that the user's 5.54 GB GGUF or even a tiny model will be fast on 2 GB.
- **Preferred minimum for optional small local AI: 4 GB RAM.** Explicit on-device preflight, one loaded model maximum, bounded context and tokens, graceful termination on memory pressure.
- **6–8 GB:** optional intermediate local models only when actually tested.
- **16+ GB:** optional larger GGUF. The user's 5.54 GB archive must never be included in the baseline bundle.
- No Internet, paid API, account, GPU, Docker, training or LLM download may be required to run the minimum app's offline core. Advanced autonomous coding can continue to require the existing secure Docker gate on devices where supported.

## One codebase, platform-specific runtimes

1. Preserve the current shared HTML/CSS/JS interface and stable API contract. Do not build competing navigation systems.
2. Keep the existing Python stdlib engine for desktop. **Android needs a separate minimal ARM64-native service/adapter and safe WebView host** backed by SQLite and approved native operations. Never imply the current Python source is an Android APK.
3. Native Android GGUF inference must be **optional**, CPU-compatible, and dynamically installed where permitted. The 2 GB model-free experience must not depend on it.
4. Keep auth, per-project permissions and isolation, approval/digest/rollback, audit, Git evidence, prompt-injection resistance and separate security gates.
5. Avoid polling-heavy workers; add hardware-aware concurrency, token/context, cache and memory limits. Measure battery/heat and memory using real devices.

## Master packaging and cleanup

- Produce a **single immutable named ZIP** `TheOrg's Master.zip`, containing a small source runtime and readable master spec/manifest. Distribute the 5.54 GB GGUF and other large model files separately, always user-approved.
- Exclude from the **runtime archive only**: old docs, repository history, Python bytecode, test fixtures, CI workflows, build caches, binaries, unused assets and model weights. Preserve them in GitHub/development releases.
- Use reproducible ZIP Deflate packaging and per-file SHA-256 manifest; verify before publishing and after extraction.
- The master ZIP must **not recursively zip itself**, rewrite itself while open, or delete itself after extraction.
- Future native builds may lazily extract/version only required files and atomically promote validated updates, with rollback.
- Never delete user documents, memory, SQLite databases, Git projects, audit logs, credentials, custom models, settings or unrecognized files. **Clean only application-owned temporary staging files** based on explicit names and age, with preview/dry-run as the default and a separate apply approval. Do not follow symlinks or use last-opened-time guesses to identify safe deletions.
- Use SQLite backup APIs for durable backups rather than compressing a live database. No unsafe compression-in-place.

## Acceptance gates (must provide evidence)

- Real 2 GB ARM64 Android and low-end Windows device: base UI, persistence, local search and task queue operate without a model or network.
- Actual Android APK build and startup on physical 2 GB and 4 GB tablets. No desktop-only acceptance substitute.
- Record startup time, peak RSS/PSS, installed and temporary bytes, storage quota, thermal/battery, crash/OOM incidents, tests executed, CPU/OS details.
- Verify every ZIP member with SHA-256 and confirm the runtime bundle contains no model weights, secrets or hidden developer-only files.
- Cleaner tests: dry run has zero mutations; applied cleanup removes only expired allowlisted staging artifacts; blocked symlinks and protected files remain intact.
- Verify the current source unit tests on Linux and Windows separately. Never claim real-model, GPU or Windows EXE compatibility from mock unit tests.
- Changes must remain review-only until passing security and release gates. **Do not downgrade safeguards to meet size targets.**

## Ordered work

- **P0:** hardware budget and real-device baseline, packager, manifest, safe temporary cleaner and tests.
- **P1:** Android native shell + API adapter, persistence isolation, offline/low-memory verification.
- **P1:** device-aware optional tiny model and feature gating; no mandatory large weights.
- **P2:** knowledge ingestion, larger GGUF options and specialist fine-tuning only where supported and tested.

**Current status:** The Drive master ZIP is source-only and intentionally uses the v0.10 release-gates base. PR #18 adds unmerged LLM integration changes; ship them inside a newly verified successor master ZIP only after acceptance.
## 2026-11-11 — Bulk integration checkpoint (review-only)

This integrated development branch contains the v0.10 offline engine history from PRs #16–#18 and adds:
- Autopilot test-count anti-regression: changed tests must meet the verified pre-edit count.
- Persistent five-role advisory coordinator, project Git SHA binding, fresh approval after restart, cancellation and audited SQLite history.
- Disabled-by-default, single-use capability approvals with local HTML-only Playwright inspection and restricted Windows workspace opening.
- Code Studio advisory review panel with explicit scope acknowledgment.
- Deterministic source-only packager excluding GGUF weights, SQLite databases, access tokens and real user workspaces.
- Fail-closed readiness report requiring separate source, Windows, real coding-model, browser and agent acceptance.

**Architecture boundary:** GitHub main's Chrome MV3/.NET Native Messaging preview and this Python offline engine are still distinct runtime tracks. This change does not provide a verified Chrome-to-engine adapter. No unauthenticated browser-to-engine calls.

**Verification boundary:** Mocked/source tests cannot prove real GGUF inference, Docker Autopilot, Windows EXE usability or full browser/desktop automation. Keep the candidate review-only until independent acceptance receipts pass.
