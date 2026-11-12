# TheOrg chat design gap closure — 12 November 2026

**Review branch:** feat/agent-execution-handoffs-independent-qa (PR #23)
**Implementation:** committed source only, not a certified Windows/browser visual release.
**Target:** ChatGPT-like simplicity plus Codex-style review panels with an original TheOrg identity.

## 1. Conversation continuity and organization

- Session titles, archive/restore and task grouping persist in local SQLite.
- Prior-task context is explicitly enabled by the user for each session; default OFF. It captures excerpts from at most three completed tasks in the same session, capped at 3,200 characters, then stores an atomic snapshot with the queued task.
- Local models receive the snapshot labeled as untrusted reference data, followed by the actual current prompt. This does not enable external providers, change permissions, or authorize tools.
- A disabled setting applies to future tasks only; previously queued prompts are not silently rewritten.
- Ordinary task APIs expose only a context-used indicator, never the duplicated prior transcript.
- Revise creates an editable draft without changing the original. Branch creates an independent local session and editable draft, without inherited context or permissions.
- This is limited opt-in continuity, not full ChatGPT-style context-window management or conversation memory.

## 2. Search all saved local tasks

- Quick filtering applies to the recent visible task feed.
- Search history queries all saved SQLite task records, or only the selected session, with at most 25 bounded results. No network indexing, cloud sync, or external AI search occurs.
- Exact selected task records can be retrieved through an authenticated read-only endpoint. Search responses omit raw stored context snapshots.
- All user/model text remains safe text in the UI, never evaluated or inserted as raw HTML.

## 3. Execution inspector and failure handling

- Task tab displays task ID, role, status, created/updated time, and a timeline based only on real local queue records.
- Code changes tab reads existing Code Studio proposals, SHA-256 digests, textual file diffs and verification evidence; these are independent proposals, NOT asserted to have been caused by the selected chat task.
- Inspector code requests are read-only. Apply/test/commit/revert and external actions require their original separate approval mechanisms.
- Interrupted tasks can only be retried after explicit confirmation; failed tasks link to local model diagnostics.

## 4. Consistent, responsive appearance

- Added static/design_polish.css after the base and chat CSS with a unified neutral design, spacing, typography, surfaces, component sizing, icon states and keyboard focus.
- Supports responsive desktop/tablet/mobile layouts, reduced motion, forced high-contrast colors, short-height windows, error/empty/search states, and responsive message/inspector panels.
- Composer has visible busy/error/queued states and adaptive height. Large task outputs are no longer concatenated on every polling interval.
- No paid asset, CDN or tracking dependency added. The stylesheet is cached offline and hashed by Adaptive source integrity checks.

## Regression sources

- offline_desktop/tests/test_chat_context.py: default-off context, completed/same-session-only boundaries, bounded prompt snapshots, model input ordering and source privacy.
- offline_desktop/tests/test_api.py: authenticated opt-in, full-history search, exact task lookup, no raw context leakage.
- tests/chat-design-completion.test.cjs: DOM controls, read-only inspector, privacy claims, responsive styling and cache/manifest coverage.
- The new Node contract is included in tools/Test-TheOrg-Source-Local.ps1.

## Acceptance still required for a defensible 9.9/10

1. Dispatch bridge-ci.yml manually against the exact newest commit on the dedicated Windows runner, setting confirm_self_hosted=true and build_unsigned_windows_candidate=false.
2. Test real Windows rendering at 1440x900, 1366x768, 768x1024 and 390x844; inspect high-DPI, zoom, clipping, keyboard navigation and screen-reader announcements.
3. Test no model, real inference, model failure, interrupted tasks, long code/diffs, 100+ task histories, archive and saved-history search.
4. Verify optional context using a live local model; ensure embedded untrusted text does not grant authorization or introduce unintended actions.
5. Inspect real Code Studio diffs and evidence; confirm the inspector performs no writes or executions.
6. Verify updated service-worker cache and clean-commit SHA-256 integrity before building a Windows EXE.
7. Only then perform screenshot-based comparison and user usability testing against the current ChatGPT/Codex interfaces.

**Status:** Implementation improved, but 9.9/10 remains a design target, not a verified measured result. Production release is NO_GO.
