# TheOrg — Unified Adaptive + Local Operating Desk + Reviewed Learning

Status: **development source candidate**. This document does not certify Windows or Android binaries, installed GGUF weights, autonomous tool execution, or LoRA training.

## 1. One application / three Adaptive operating modes

`offline_desktop/engine/adaptive_runtime.py` chooses among Adaptive 1 (Nano), Adaptive 2 (Lite), and Adaptive 3 (Advanced) based on **measured available system RAM**, available CPU-only llama.cpp executable, and installed local GGUF headers. A missing runtime/model or unknown RAM fails closed to Nano. Automatic selection does not automatically load model weights. `POST /api/adaptive/start-recommended` requires a separate owner approval and a fresh GGUF/memory preflight. A successful model launch still requires **real generation probe** before inference is considered verified. Do not confuse system RAM with GPU VRAM.

## 2. Local-first user-controlled data

Tasks, chat sessions, workspace files, and notes are retained in device-local folders and SQLite. The new `/api/operating/overview` reads aggregate counts only. It does not return task prompts, private memory text, access tokens, or credentials. `/api/operating/route` is a **preview**, not a dispatch. Neither endpoint contacts cloud providers, starts workers, or supplies execution approval. Local file changes and developer tool actions continue to require the existing scope/approval controls.

## 3. One agent operating environment

The read-only operating desk surfaces status across personal tasks, company jobs, Code Studio, workflows, and reviewed solutions where the local tables exist. Counts are facts from SQLite, not fabricated execution logs. The real execution path remains the preexisting approved endpoints; no prompt or model output can grant its own new authorization. Interrupted tasks require manual recovery, with no automatic replay. Agent-team dispatch and QA remain separate approval gates.

## 4. Reviewed learning (never automatic training)

Only **owner-verified** stored solutions are eligible for normal recall. Completed agent responses can be saved to an **unverified candidate** queue via explicit permission. Approval requires independent owner-supplied evidence, and superseded records are retained. No model weights are modified.

The `reviewed_knowledge.py` transfer API supports:

- `POST /api/adaptive/knowledge/export` — `{"confirmed":true,"limit":12}`; produces at most 12 approved solution records plus SHA-256; requires consent. The export omits separate memory records and access-token files, **but solution text may itself contain private material**. Inspect before sharing.
- `POST /api/adaptive/knowledge/validate` — pass `{"bundle":{...},"sha256":"..."}`; validates schema, exact hash, record sizes and HTTPS source URLs with no writes.
- `POST /api/adaptive/knowledge/import` — pass the bundle/hash with `"confirmed":true`; all records are quarantined as **candidates**, evidence is not inherited, duplicates are skipped, and nothing is promoted automatically. SHA-256 is an accidental-change check, not authentication.
- `POST /api/adaptive/solutions/review` — owner must supply independent verification evidence and `"confirmed":true` to promote.

All endpoints require the existing TheOrg bearer token on localhost. File import is bounded by the existing 150 KB JSON API cap and the stricter 120 KB knowledge-document cap. The UI exposes review, reject, export, and import actions. Import/export are fully local; the browser creates/opens a local JSON file and no automatic remote sync occurs.

## 5. Evidence and remaining launch gates

Source verification run on Linux in development environment:

- Python unit suite: 219/219 passed.
- Node.js contract/renderer suite: 45/45 passed.
- Engine `--self-test`: passed.
- Python compile and JavaScript syntax: passed.

These do **not** replace: Windows x64 build and smoke tests, real 0.8B/2B/4B GGUF downloads with upstream digests/licenses, real inference and memory benchmarks, Android APK build/device validation, remote inference safety review, and independently evaluated LoRA training. No production merge or deployment is authorized by this source change.

## 6. Release workflow

Use PR #23's branch `feat/agent-execution-handoffs-independent-qa`. Run the manually gated Windows source-verification CI on the **exact intended commit**, then build a Windows candidate and independently verify its manifest and startup. Do not promote `source_only` manifests to binaries or production release artifacts. Preserve immutable original archives and user-owned data separately.
