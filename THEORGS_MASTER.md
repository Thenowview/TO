# TheOrg's Master — v0.11.0-rc1 (review-only)

**Goal:** Preserve the existing TheOrg architecture with a model-free lightweight source core on constrained devices, optional GGUF intelligence, scoped coding tools, and explicit verification gates. This RC is not an Android APK, Windows EXE, or trained LLM.

## Product layers
A. Python/SQLite dashboard/task queue/audit/file operations; no model/GPU/network required to start.
B. Optional GGUF inspection, llama.cpp backend, role behavior prompts and bounded project-context retrieval.
C. Controlled Code Studio edits, exact SHA/digest approval, isolated tests, local Git evidence, rollback and gated Autopilot.
D. Existing SQLite task queue plus a persistent structured workflow coordinator. Step authorizations expire, recovery does not silently renew them, and actions require explicit API approval; no uncontrolled agent-to-agent chat or model-launched tools.
E. Device capability API now available; optional browser/desktop gateway and native Android adapter **not implemented**.
F. Reproducible lightweight ZIP, per-file SHA256 manifest, external release receipt and test-derived status.

## Device targets vs verified capability

| Tier | RAM target | This release |
|---|---:|---|
| Minimum | 2 GB | Model-free core is designed for this; physical target **NOT TESTED**. |
| Basic | 4 GB | Optional tiny AI only when device/model free-RAM preflight passes. |
| Enhanced | 6–8 GB | Optional additional context subject to preflight. |
| Workstation | 16 GB+ | Large GGUF optional; the supplied 5.54 GB archive was not loaded or tested. |

No dedicated GPU, Docker, paid API or model is needed for **model-free** local core. Real system RAM should be measured; total RAM is not a substitute for free RAM. If free RAM cannot be determined, built-in model startup fails closed. No claim is made about Windows/Android real-device performance.

## Compatibility and source reconciliation

Baseline: existing v0.10 release-gates developer source archive, PR #17. Ported compatible PR #18 capabilities into source-only runtime: versioned role prompts, bounded GGUF header metadata, symbol-aware context, strict structured JSON model proposals. Runtime API and Code Studio remain the same except additional optional endpoints and fields. User documents, SQLite data, Git workspaces and models are stored outside update archives and are never deliberately erased by installation.

`models/README.md` references `scripts/get_qwen_tiny.py`; the script is included here, **never invoked automatically**. It requires explicit approval and a separate Internet connection if chosen. Historical files do not become a bundled LLM.

## Security and recovery

- TheOrg binds its API to local trusted hosts and requires the existing bearer token. No unauthenticated tools.
- Memory notes do not enter developer, QA or security inference prompts; project content remains untrusted data.
- AI-generated proposals can be reviewed only; model text does not directly apply, run tests, commit or deploy.
- Existing Autopilot sandbox/release gates from PR #17 remain mandatory, and failed-gate evidence remains a blocker.
- Restarted tasks are marked `interrupted`; `POST /api/tasks/retry` requires `{ "id": "...", "confirmed": true }` and the existing token.
- The cleanup script has a dry-run default, age/filename allowlist, protects linked files and never deletes live databases, GGUF, user files or the master ZIP.
- Archive is immutable and never zips itself. Validate `MASTER_MANIFEST.json` and separate `.sha256` before extraction.
- Preserve the prior release ZIP and user data directory for rollback. Never overwrite files in place without a separately reviewed upgrade procedure.

## Build source package

```sh
cd offline_desktop
python -m unittest discover -s tests -q
node --check static/app.js
python app.py --self-test
python scripts/build_master.py --output '../TheOrg Master-v0.11.0-rc1.zip' --source-ref 'review-source'
```

The builder runs checks again, lists only approved runtime source, and emits a SHA256 and JSON receipt. It excludes `.git`, tests, caches, workflows, binaries, database, user files, credentials and GGUF weights. Tests and the Windows builder remain in the **developer repository**.

## Verification status

- Source regression: 97 Python tests passed locally on Linux in the initial upgrade; re-run before release.
- JS syntax and Python self-test: passed locally.
- Real GGUF loading, structured inference on actual weights, autonomous coding hidden tests: **NOT TESTED**.
- Windows portable EXE CI and physical 2 GB/4 GB Android APK: **NOT TESTED / BLOCKED**.
- PR #17/#18 remain draft and unmerged; release publishing requires separate review and acceptance.

All hardware limits are targets. Do not infer success from synthetic fixtures, source checks or metadata parsing.
