# Windows PC Assist accessibility adapter — draft candidate

This adds actual Windows accessibility observation and selected-control actions,
rather than only a Notepad launcher. The Supervisor can enumerate visible windows,
inspect up to 150 non-password/non-offscreen controls, enter ordinary text through
ValuePattern and press supported controls through InvokePattern. This is a draft
implementation, not physical-device or complete-task acceptance.

A fixed, embedded PowerShell worker loads Windows UI Automation assemblies. User
data travels over stdin as JSON, never as shell source or command arguments. No
user-selected command executable, global keystrokes, mouse coordinates, screenshot
scraping, new OS privileges or arbitrary script evaluation are exposed. Worker
execution has a 12-second deadline. A blocked action may already have occurred.

Each proposal pins window handle, process ID, process start time, window title,
control RuntimeId/name/type and exact input/result expectation. Execution requires
the exact proposal fingerprint. A FileMode.CreateNew claim prevents duplicate
dispatch across native-host processes. Receipts and pending/unknown history are
stored under the existing company/order workspace. A missing receipt after a
claim never permits an automatic retry.

Local evidence: 67 Node component/security/contract checks pass (including three
desktop UI/caller-boundary checks); Windows worker PowerShell syntax parsing and
Python smoke-test syntax parsing pass. New .NET self-tests validate the action
schema without executing UI actions. The new actual-executable Python test covers
proposal persistence, denied approval, company isolation and rejected commands;
it deliberately never invokes a desktop action. Its runtime result must be taken
from candidate CI, not local syntax validation.

Remaining before acceptance:
- Compile/run the native schema tests on Windows for the exact candidate.
- Demonstrate set-value and invoke/result observation against a synthetic app.
- Verify the installed owner-PC native connection and actual supported applications.
- Natural-language/adaptive planning, multi-action task orchestration, save/reopen
  document proof, cross-window tasks, richer control patterns, localization and
  comparative benchmarks are not implemented by this adapter.
- Review receipt/path race handling and credential-data handling before release.
- UI Automation does not cover every app, browser canvas or elevated process.
- Existing local-agent catalog remains separate; its Notepad tool is still launch only.
No 10/10 readiness, signing, deployment, production acceptance or competitor
superiority is claimed.

## Follow-up: reviewed local-model plans and runtime acceptance harness

The candidate now supports optional local-Ollama planning from the stored owner work
order and a fresh observation. Output is restricted to 1–12 closed accessibility
actions using observed controls in one pinned window. The owner reviews the exact
plan fingerprint before execution. Per-window locks prevent concurrent plans from
controlling the same window. Per-step durable receipts survive failures; stop takes
effect before the next action. Interrupted or dispatched work is not replayed.

Invoke result text must newly appear after dispatch. Pre-existing results are rejected.
Local validation: 68 Node checks pass, plus worker/Python syntax checks. All four
workflows passed for the earlier compile-fixed 8f770fb91a498d5e4f342c36d29ece5f87d39e12.
The newer planning, cancellation and synthetic-app test changes need fresh CI.

tests/desktop-accessibility-smoke.py drives a disposable WinForms fixture in Windows
CI: actual window/control observation, password exclusion, input/readback,
invoke/result assertion, fresh-process receipts, replay rejection and process
identity checks. No runtime pass is claimed before its candidate CI result.

Owner-PC installation, real local-model inference, adaptive replanning, multi-window
save/reopen workflows, full localization and competitive benchmarks remain open.
No production acceptance, 10/10 score or VERIFIED source ID is inferred.

