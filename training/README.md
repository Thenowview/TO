# TheOrg Adaptive — supervised learning and adapter-training workflow

**Current status:** Training DATASET PREPARATION implemented; no real LoRA training, weight modification, or external website training completed.

## Adaptive architecture

One codebase serves three independently selectable policies:

- **Nano / Adaptive 1:** model-free local tasks, approved tools, SQLite recall. Can run without any GGUF. Original Drive folder is currently empty.
- **Lite / Adaptive 2:** for suitable ~4–8 GiB systems, optional 0.8B or 2B local quantized GGUF (if licensed, installed and hardware checks pass). The dedicated 2B entry in `config/adaptive-model-registry.json` is a source-catalog candidate, **not** a downloaded model.
- **Advanced / Adaptive 3:** for capable systems, optional 4B/9B local GGUF. The Drive folder contains source references; the 9B original ZIP is preserved and the 4B binary is not downloaded or inference-verified.

An edition selection never downloads model weights, proves inference, installs software, bypasses authorization or trains anything. Nano remains the model-free fallback when RAM is insufficient.

## Safe adaptive knowledge lifecycle

1. Check `POST /api/adaptive/resolve`: search **verified local SQLite solutions** first.
2. If a verified match exists, present it with evidence and an applicability warning; do not claim a source is current without checking.
3. Otherwise, use model-free tools or offer an explicitly authorized local-model inference flow, with a successful real probe before benchmarking.
4. If an external AI website or search provider is needed, use a separate, user-approved connector. Do not transmit secrets or workspace files implicitly.
5. Capture a solution as a **candidate** using `POST /api/adaptive/solutions/propose` or a completed task through `/api/adaptive/solutions/from-task`; unverified candidates are not returned by normal recall.
6. Independently verify outcome with source evidence and approve or decline through `/api/adaptive/solutions/review`. Corrections **supersede** old records rather than silently erasing history.
7. Periodically review stale solutions and manually revoke/correct them. No unreviewed self-learning, autonomous data purging or weight edits occur.

## Dataset preparation (opt in only)

Use the reviewed owner-controlled SQLite data as input. Examples are explicitly exported to a separate new file, not sent online. The export rejects obvious credentials, candidate/unverified solutions and accidental overwrite.

```powershell
python tools/prepare-adaptive-training.py export --db "<YOUR THEORG DATA PATH>\theorg.sqlite3" --output "<PRIVATE OUTPUT PATH>\approved-train.jsonl" --confirm-reviewed-export
python tools/prepare-adaptive-training.py validate --file "<PRIVATE OUTPUT PATH>\approved-train.jsonl"
python tools/prepare-adaptive-training.py validate --file "<PRIVATE OUTPUT PATH>\approved-train-validation.jsonl"
```

These scripts prepare and validate JSONL only. They are not a verified LoRA/QLoRA training pipeline. Before actual adapter training, the owner must:

- Verify rights to the chosen 2B, 4B or 9B base model and all examples.
- Review and redact sensitive personal/company data; heuristic secret scanning is not comprehensive.
- Use capable isolated training hardware, a pinned model/tokenizer, a documented training environment, and reproducible configuration.
- Train an adapter **outside Nano/Lite runtimes**, evaluate on withheld cases and real task benchmarks, and check regressions, privacy and model behavior.
- Sign and version the adapter artifact, obtain owner approval, and keep a rollback path before optional deployment.

No training jobs are automatically scheduled. Model weights remain external and original archives remain untouched.

## Manifest and packaging

```powershell
python tools/adaptive_integrity.py create --output out/adaptive/manifest.json
python tools/adaptive_integrity.py verify --manifest out/adaptive/manifest.json
```

Only create the manifest on the **reviewed, clean Git checkout**. Verification refuses stale hashes or a different SHA and flags nested compressed archives in active static assets. It deliberately does not delete or rewrite prior Drive packages or guess the paths of the four reported stale hashes. Once that original archive is supplied to a build machine, reconcile each file with its signed or independently reviewed baseline, regenerate the package manifest from approved bytes, then verify it before distribution.

The source packaging excludes GGUF weights and runtime/user data. The Windows onefile builder is configured to include the canonical Adaptive registry, but all three Windows packages and Android native runtime still require independent real-device builds and acceptance. No signed production release has been verified.

## Acceptance gates (not yet met)

- Isolated four-case RAM preflight suite and full Python/Node source checks pass on current Git SHA.
- Nine-file Adaptive integrity manifest generated and verified on a clean checkout.
- Nano model-free tools actually run on minimum hardware.
- Lite 2B and Advanced 4B/9B real GGUF inference tested on representative devices with approved model rights.
- Optional LoRA adapter training validated with reproducibility, QA and rollback; no automatic self-training.
- Windows EXE and Android application build, hardware acceptance, permissions, offline behavior and signing verified for applicable editions.
- Duplicate assets examined and retired only after backup/dependency confirmation.
- Draft review PRs receive code/security review and only then are integrated. Production remains **NO_GO**.
