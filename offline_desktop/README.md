# TheOrg Portable v0.10 — model archive import and readiness testing

**Local-first Code Studio with bounded Autopilot.** This is a **tested source release and Windows EXE builder**; a tested Windows `.exe` is **not** included in the ZIP unless a Windows CI build has subsequently completed. TheOrg's score has not been recalibrated against real Codex tasks.

## Run locally

- Requirements for source mode: Python 3.10+, Git; internet is not required for workspace mode.
- Windows: run `Start-TheOrg-Windows.cmd`; Linux/macOS: `python app.py`. Default browser opens `http://127.0.0.1:8765` with a session-only token fragment.
- Portable Windows EXE: `Build-TheOrg-Portable-Windows.ps1` on Windows with build-time internet; downloaded upstream llama.cpp CPU runtime and portable Git are pinned by SHA-256. The executable creates a desktop shortcut on first start. **Windows build and shortcut are not verified here.**
- Model operation: import an extracted `.gguf` into the Models page and start a compatible bundled `llama-server`. No Ollama required in the compiled Windows package. GGUF weights are not included; no actual offline-model generation test has passed in this release.
- Autopilot: requires a running local model **and** an already installed Docker engine with an already available offline sandbox image. No network, host project mount, auto-pull, remote Git push or production deployment.

## v0.8 features carried forward

1. **Context-aware code exploration:** objective-scored, bounded local project files replace arbitrary first-file selection. The Code Studio **AI context preview** shows the model's selected source files and file scores. Retrieval works without an AI model.
2. **Model output budget control:** inference now accepts an explicit token budget (up to 3,000), with 1,800 requested for coding proposals. The llama.cpp CPU runtime uses a configurable context window (`THEORG_MODEL_CONTEXT`, default 4,096; allowed bounds 2,048–8,192).
3. **Fail-closed baseline regression gate:** before any autoapproved edit, an offline sandbox must pass the existing tests. Existing failures block the run and preserve the Git baseline.
4. **Immutable sandbox image binding:** runs use the inspected local Docker image SHA-256 digest instead of relying on mutable image tags.
5. **Timeout cleanup:** on test completion or timeout, TheOrg tries to remove the uniquely named Docker test container and records cleanup warnings. A Docker daemon failure can still prevent cleanup; operators must monitor their local Docker daemon.
6. **Regression tests:** expanded to **78** unit/API tests in v0.10; clean source extraction, dashboard JS syntax, and a local API smoke test are required for this package.

## v0.9 changes (carried forward)

1. Local model readiness probe requires a real non-empty inference response; readiness without model weights is not evidence of real generation.
2. Local inference rejects malformed or empty model responses and disables HTTP redirect following to avoid prompt exfiltration via a compromised loopback endpoint.
3. Test verification requires a positive discovered test count; an empty test suite cannot approve a change.
4. Git bundle export produces a recoverable offline Git repository snapshot and refuses a dirty worktree.
5. Model probe and Git export are exposed in the local dashboard.
6. The Windows EXE and real GGUF inference remain unverified.

## v0.10 additional capabilities (78 source tests)

1. **GGUF ZIP import from the dashboard:** supports a local `.zip` containing exactly one valid-looking GGUF. The archive is safely validated, staged on disk and streamed into local model storage; nested model paths are reduced to a safe basename. No cloud service or Ollama is involved. ZIP upload requires enough free disk space for both the temporary ZIP and extracted GGUF; the temporary ZIP is deleted afterward.
2. **CPU memory preflight:** conservative estimated RAM requirement (approximately 1.2 times model file size plus 1 GiB) is checked against currently available physical RAM. This is a floor estimate, not a promise the model will load. Low-memory devices should choose smaller GGUFs.
3. **Structured-output local benchmark:** one real endpoint challenge checks a JSON schema and simple arithmetic. No score is claimed without the actual model. The CLI supports `python app.py --benchmark-model`.
4. **Extended acceptance evidence:** 78 automated source tests, including 16 new ZIP, RAM and benchmark cases. Source tests use mock model responses; real AI and Windows binary tests remain separate gates.

## Scope boundaries

- **Available without any LLM:** dashboard, SQLite task/memory data, code search/context, project creation, approved manual edits, local Git and source verification.
- **Available with a real supported local model:** chat and draft generation, once configured and running. No real GGUF/response-quality benchmark is claimed.
- **Autopilot with offline Docker:** scoped proposal → digest approval → edit → baseline and edited-test evidence → optional rollback/repair → local commit. This release does not implement general Codex-like shell execution, arbitrary repository cloning, hosted cloud agents, GitHub pushes, IDE integration, phone-native LLM inference, or general-purpose desktop control.
- **Safety:** Docker is an isolation layer but not a guaranteed hostile-code sandbox. There is no claim of protection against container/runtime vulnerabilities. Trusted-local tests run under the user's OS account and require an explicit opt-in; never use them with untrusted code.

## Verify

```sh
python -m unittest discover -s tests -q
node --check static/app.js
python app.py --self-test
```

See `docs/V0_10_VERIFICATION.md` for exact evidence. **Do not promote this package to a 9.6/10 Codex-equivalent until real-device, model, GitHub, and adversarial benchmarks are passed.**


## Acceptance gates for the portable Windows release

The source test suite is **not** proof of a functioning Windows executable or real autonomous coding.

1. Run \`python -m unittest discover -s tests -v\` and \`node --check static/app.js\`.
2. Windows CI must build the actual \`TheOrg.exe\`, execute its \`--self-test\`, serve the localhost dashboard, reject an unauthenticated API call with HTTP 401, verify packaged Git and llama-server, and create a local Git project.
3. \`python scripts/check_release.py dist --report dist/RELEASE-ACCEPTANCE.json\` requires an AMD64 PE header, matching SHA-256 manifest, pinned upstream dependency digests, and a matching Windows runtime receipt. It fails closed on missing evidence. CI publishes the executable only after this gate passes.
4. On a device with a running **real** GGUF via llama.cpp at \`127.0.0.1:8081\` and a locally cached Docker sandbox image, run \`python scripts/acceptance_real_autopilot.py --report acceptance-real.json\`. This uses a disposable synthetic Git project and checks genuine inference, a verified local commit, nonempty sandbox tests and independent hidden tests. It does not push changes to any remote.
5. A missing local model, Windows runner, Docker image or passing independent test means **NOT VERIFIED**, not a simulated pass.

The Windows CI pipeline cannot prove coding-model quality when model weights are unavailable. The real-model acceptance report must be retained separately before any parity rating is increased. No source or artifact should be deployed or merged merely because source tests pass.
