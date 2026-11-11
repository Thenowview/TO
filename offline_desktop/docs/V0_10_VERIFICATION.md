# TheOrg Portable v0.10 — Source verification and acceptance

**Build date:** 2026-11-11  
**Channel:** source and Windows builder; not a compiled Windows binary

## Tested in this environment
- Local Python 3.13 unit/API tests: **78 passed**.
- Fresh source extraction, JavaScript `node --check`, Python syntax compilation and `app.py --self-test`: tracked in package verification manifest.
- ZIP GGUF extraction: a real local ZIP archive containing a synthetic GGUF-header payload is extracted, hashed and installed; path traversal, symlink entries, duplicate models, damaged ZIP, truncated input and excessive compression are rejected.
- Memory-capacity preflight: fails closed when model weight size plus estimated working memory exceed available physical RAM. This is a conservative estimate and does not prove model compatibility.
- Structured-output model benchmark: the endpoint and schema checks are mock-tested only. A real GGUF runtime/model remains necessary.
- Auto-coding development loop: existing simulated-model tests pass; real AI coding is **not** independently benchmarked.

## Not verified
- A real DeepSeek or Gemma GGUF response (weights not accessible in the current environment).
- Build, signature, install, shortcut or execution of `TheOrg.exe` on actual Windows hardware.
- Secure execution of adversarial code inside Docker; container isolation is not a certified security boundary.
- Android native inference, GitHub PR automation, live browser control or Codex feature parity.

## Device acceptance gates
1. The Windows GitHub Actions runner must compile a portable `TheOrg.exe`, execute `--self-test`, start localhost on a dedicated port and fetch the dashboard, then produce the EXE hash.
2. The user chooses a `.gguf` or single-model `.zip` in the Models tab; no network service or Ollama is required. The ZIP importer requires temporary free disk space to stage and extract the archive.
3. The model preflight must show adequate available RAM and a bundled llama-server. Start the model, then run **real local generation** and **structured-output benchmark** from the dashboard.
4. A separate, explicitly scoped coding benchmark must change an isolated test project, execute non-empty tests, repair any failure and record a verified local Git commit.
5. Only then update the comparative maturity rating; test-count growth is not a proxy for coding quality.

## Important behavior
TheOrg is usable without an LLM as a local workspace, and its models are separate optional files. Chrome's built-in AI is hardware-dependent and not synonymous with access to signed-in AI provider websites. The hidden local `.theorg` directory is not encrypted. For untrusted code, Autopilot requires an offline Docker image and explicitly refuses a less isolated fallback.
