# TheOrg Adaptive — three-edition architecture and gap register

**As of 12 November 2026 | source branch only | PR #23 draft | production NO_GO**

## Original source evidence

Google Drive sources:

- [Adaptive 1 — Nano](https://drive.google.com/drive/folders/1oOXLbWl__ZLkpQkq3Aa1X6NUPOQXYttS) — folder currently empty.
- [Adaptive 2 — Lite](https://drive.google.com/drive/folders/1dwSnYY-r2OIk8srLNo8aAlN2jhVBzadM) — folder currently empty.
- [Adaptive 3 — Advanced](https://drive.google.com/drive/folders/1p7s-y3nT1P6I2QcTPcYn-UQ4oq4l7mJ6) — source folders for 4B and 9B.
- [Adaptive model registry and rules](https://drive.google.com/drive/folders/18vYAJn0rCGP-01O7zivtqZWR4ysblOsj) — source registry v2 describes Nano/Lite/Advanced and expressly states weights, Android native build and real inference are not verified.
- The 9B source note confirms a preserved original ZIP and no independent inference; the 4B source note says reference-only, binary absent.

Do not infer that these folders contain executable models, training datasets or releasable binaries. No Drive data was moved, deleted, compressed, or modified.

## Architecture delivered to review branch

```text
TheOrg (ONE codebase and SQLite workspace)
├── Chat / Supervisor / Approved tools
├── Adaptive Runtime Policy
│   ├── Adaptive 1 — Nano: model-free, local tools and reviewed knowledge
│   ├── Adaptive 2 — Lite: optional 0.8B/2B GGUF, RAM-gated
│   └── Adaptive 3 — Advanced: optional 4B/9B GGUF, RAM-gated
├── Local-first Resolution
│   ├── Search only owner-verified knowledge (SQLite)
│   ├── Model-free tools or separately approved local LLM
│   └── Explicitly authorized external provider or web source
├── Learning Loop (reviewed)
│   ├── Completed result → candidate (not trusted)
│   ├── Owner evidence and approval → verified record
│   ├── Correction → old version superseded, not silently erased
│   └── Optional explicit JSONL export → future LoRA on capable hardware
└── Source and packaging controls
    ├── Clean SHA / SHA-256 integrity manifest
    ├── Reject nested archived static assets
    └── Platform-specific build/test/release gates
```

The three editions are selectable in the Models page and via the authenticated `/api/adaptive` routes. Selection changes runtime policy; it does **not** download, execute or train a model. Source-only packaging carries a single canonical registry; the onefile Windows builder includes it as a data file.

## Seven reported gaps — evidence status

| Finding | Priority | Code-stage response | Still required for verified closure |
|---|---|---|---|
| Four memory-preflight tests fail | P0 | Added isolated four-case memory-preflight step **ahead of** full Python CI; existing test module preserved | Run it on current Windows checkout, inspect failures/logs, reconcile real failing fixtures; no green run confirmed |
| Four modified files have outdated manifest hashes | P0 | Implemented clean-checkout manifest creation + SHA-256 verification; now included in source-only CI | Obtain the original affected package and filenames; review each approved version, refresh that package's four hashes, verify twice; this tool cannot guess them |
| Dedicated 2B registry entry missing | P1 | Added explicit `qwen35_2b` Lite entry, no verified publisher/binary/inference claimed | Select licensed verified GGUF source; test metadata, RAM and real generation |
| No real GGUF in tier folders | P1 | Runtime policy never assumes weights; preserved 9B ZIP and reference-only 4B | Authorized acquisition/verification of real 0.8B/2B/4B/9B weights and actual inference on eligible hardware |
| Windows/Android packaging incomplete | P1 | Source and Windows onefile builder updated to include canonical edition registry | Independently build and QA Windows + Android native package; Android runtime not yet implemented/signed |
| Static assets unpacked and nested ZIP | P2 | Duplicate static compressed archives rejected by new integrity tooling; source packaging does not include nested ZIP | Locate original duplicate archive, back up and verify dependencies, remove redundant copy only with owner authorization |
| Training folder has policy documents only | P2 | Added reviewed SQLite learning loop, dataset export and JSONL validator plus training runbook | Pin base model rights, train actual adapter on capable hardware, benchmark and review privacy, regressions, signed artifact and rollback |

**The source changes are not runtime acceptance.** The exact current branch head must pass all tests and integrity checks; there is no successful real GGUF inference or Android/Windows release evidence for this change.

## Next verified path

1. Trigger `bridge-ci.yml` manually on the exact PR #23 head using `confirm_self_hosted=true`, `build_unsigned_windows_candidate=false`. Preserve the $0 self-hosted compute policy.
2. Resolve any of the four memory-preflight failures based on actual job logs. Source/test fixtures should only be changed to reflect measurable hardware behavior; do not weaken guards.
3. Verify the clean-checkout manifest. If the four stale hashes refer to a separate Drive archive, obtain its actual manifest and original files before attempting repair.
4. Test Nano on a genuinely low-RAM system with no model; verify model-free operations and knowledge recall.
5. Acquire models only after explicit licensing/use approval. Test Lite and Advanced real GGUF generation, appropriate memory preflight and benchmark gating.
6. Build Windows unsigned candidate and Android native package independently, then do clean-device E2E and security tests. Do not mark production-ready or deploy automatically.
7. Separately test consented training dataset export and an actual adapter-training/validation run on capable isolated hardware, with owner review and rollback.

The existing release decision remains **NO_GO** until these gates pass.
