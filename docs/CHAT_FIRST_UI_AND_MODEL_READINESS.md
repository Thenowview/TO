# TheOrg — Chat-first UI and hardware-aware Models acceptance

**Review branch:** `feat/agent-execution-handoffs-independent-qa`
**Status:** source changes committed; latest Windows source-only CI and clean-device UI acceptance still required.
**Visual direction:** a calm, spacious chat-first workspace inspired by familiar modern coding/chat clients. All assets and icons are authored locally; do not imply affiliation with OpenAI, Codex, Claude or ChatGPT.

## Chat-first UI

- Default landing view is **Chat** (`#view-supervisor`), with an accessible task feed, bottom composer, descriptive navigation and responsive CSS at 1440/768/390 widths.
- Side navigation uses original dependency-free stroke SVG icons and short descriptions for Chat, Task queue, Code Studio, Windows Operator, Agent team, Models, Files, Memory, Overview, Settings.
- The composer supports `Enter` to queue a task, `Shift+Enter` to insert a newline, and `Ctrl+K`/`Cmd+K` to focus the composer.
- Starter suggestions only fill the input and choose a role. They never call models, queue work, open privileges or authorize tool actions on click.
- The conversation shows **real persisted local tasks** as user prompts paired with status/result. Queued, running, failed and cancelled states do not simulate answers; output is rendered with `textContent`, not untrusted HTML.
- A "New task" button focuses and clears the local draft. It does NOT delete old tasks or create persistent conversational memory; each message remains an independent task. This limitation is plainly disclosed.
- Existing standalone Code Studio, Windows Operator, models, files and approvals remain accessible and unchanged in their security policy.

## Hardware-aware Models

- `GET /api/models` adds `hardware`, `recommendation` and `inference_probe` alongside the original model files, backend preference and binary status.
- RAM is measured using the operating system's currently available physical memory, not a static model catalog guess.
- Dedicated GPU VRAM is queried **only when an installed NVIDIA driver exposes `nvidia-smi` at a known trusted location**, with a five-second timeout. For AMD, Intel, unrecognized drivers or unavailable dedicated VRAM, show **unknown**, not zero or fabricated capacity.
- Recommended model sizes are **4-bit parameter-class guidance** based on currently available RAM. Installed GGUF candidates use a conservative weight-file plus context/buffer estimate, not a guarantee of runtime compatibility or output quality.
- This TheOrg launcher remains CPU-first; measured VRAM does not imply GPU offload, CUDA support or accelerated inference. No model is downloaded, selected, installed or started automatically.
- The **structured JSON benchmark stays disabled** in the browser unless a fresh real generation probe succeeded on the chosen backend/model in this engine process.
- The API independently rejects benchmark requests without valid proof (maximum five minutes old, same model/session). Starting/stopping/reconfiguring a model, a failed new probe, restarting the engine or expiry invalidates the permission.
- The CLI `--benchmark-model` performs an actual local generation probe first, then attempts the structured JSON challenge only after success.
- A successful probe proves only a nonempty local model endpoint response. A passed single JSON challenge does not establish Codex-level reasoning, model provenance or autonomous coding performance.

## Acceptance checklist

1. Run `tools/Test-TheOrg-Source-Local.ps1` and full Python/Node regression suites against the **same current commit**.
2. Run the new `tests/chat-first-ui-contract.test.cjs`, `tests/operator-ui-contract.test.cjs`, `offline_desktop/tests/test_model_hardware.py`, updated `test_v010_benchmark.py` and `test_api.py`.
3. Test chat layout at 1440, 768 and 390 CSS pixels; keyboard-only navigation, focus visibility, long messages, accessibility labels and screen-reader status announcements.
4. Confirm empty chat, queued/running/completed/failed tasks and independent-task disclaimer with actual local SQLite records. Verify that refresh does not replace unchanged task DOM repeatedly.
5. Test on real Windows hardware where NVIDIA VRAM is available, then on AMD/Intel or no suitable driver where GPU memory correctly remains unknown.
6. Test with no model, insufficient free RAM, supported GGUF, invalid GGUF, unavailable llama-server, failed inference, successful real inference, selected-model switch and five-minute proof expiration.
7. Confirm browser Benchmark stays disabled until a real probe, and direct POST/CLI requests cannot bypass the backend gate.
8. Package a Windows unsigned developer candidate only after the latest full source CI passes; verify the actual EXE/native messaging host on a clean device.
9. Review and merge draft PRs in dependency order only after required approvals and checks. **Production remains NO_GO.**

## Evidence boundary

This document describes review-branch implementation and necessary tests. Source changes, synthetic tests and static checks do not certify device-specific VRAM detection, real inference, browser usability, installer quality or production security.
