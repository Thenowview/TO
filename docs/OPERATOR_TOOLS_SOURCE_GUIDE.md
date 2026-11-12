# TheOrg P0 operator tools — source candidate

**Status:** implemented in review branch, NOT validated as real Windows/GitHub execution.
**Security default:** all new execution flags are disabled. No silent system control.

## Integration points

- `offline_desktop/engine/operator_tools.py`: bounded deterministic preview, Windows read-only inspections, GitHub runner/workflow status, source-only CI dispatch.
- `offline_desktop/engine/capabilities.py`: registered tools, strict argument normalization, single-use 5-minute digest approvals, SQLite audit evidence and restart-aware `needs_review` for uncertain execution.
- `offline_desktop/app.py`: authenticated `POST /api/operator/plan`; no execution performed by preview.
- `offline_desktop/tests/test_operator_tools.py`: synthetic security and state-machine tests with fake GitHub API.
- `offline_desktop/tests/test_api.py`: HTTP authorization and nonexecution tests.
- `offline_desktop/engine/local_validation.py`: bounded, pinned Windows source verifier for an explicitly trusted local checkout.
- `offline_desktop/tests/test_local_validation.py`: SHA mismatch, dirty checkout, malformed/stale report and approval tests.
- `offline_desktop/static/index.html` and `static/app.js`: Windows Operator cockpit; preview, enabled tools, one-time confirmation and local history.
- `tests/operator-ui-contract.test.cjs`: UI authorization and rendering contracts, included by the source verifier script.

## Available tools

| Name | Effect | Required environment flag | Arguments |
|---|---|---|---|
| `desktop.runner.inspect` | Local known-file inspection | `THEORG_ENABLE_RUNNER_DIAGNOSTICS=1` | `{"location":"user_downloads"}` or `{"location":"system_root"}` |
| `desktop.runner.registration_prompt` | Open private interactive registration wizard (does not register without owner token) | `THEORG_ENABLE_RUNNER_CONTROL=1` | `{"location":"user_downloads"}` or `{"location":"system_root"}` |
| `desktop.runner.start` | Open registered runner console (does not assert Online) | `THEORG_ENABLE_RUNNER_CONTROL=1` | `{"location":"user_downloads"}` or `{"location":"system_root"}` |
| `windows.powershell.inspect` | Read-only fixed PowerShell 5.1 script | `THEORG_ENABLE_WINDOWS_INSPECTION=1` | `{"check":"toolchain"}` or `{"check":"powershell_version"}` |
| `github.runner.status` | Authenticated GitHub API read | `THEORG_ENABLE_GITHUB_READONLY=1` | `{}` |
| `github.workflow.status` | Authenticated GitHub API read | `THEORG_ENABLE_GITHUB_READONLY=1` | `{}` |
| `github.workflow.result` | Verify exact commit, job, preflight and source step | `THEORG_ENABLE_GITHUB_READONLY=1` | `{"run_id":43233299196,"expected_sha":"40-character-reviewed-sha"}` |
| `windows.source.verify` | Execute fixed local source tests, no build or deploy | `THEORG_ENABLE_LOCAL_SOURCE_TESTS=1` | `{"expected_sha":"40-character-trusted-checkout-sha"}` |
| `windows.window.list` | Inspect up to 12 visible, titled top-level windows | `THEORG_ENABLE_WINDOW_INSPECTION=1` | `{}` |
| `windows.window.focus` | Attempt foreground focus for one inspected hwnd+PID+title SHA-256 | `THEORG_ENABLE_WINDOW_FOCUS=1` | `{"hwnd":431,"pid":1111,"title_sha256":"64-character-sha256"}` |
| `google.readonly.probe` | Probe official Gmail/Drive/Calendar API with private Windows credential, no record content | `THEORG_ENABLE_GOOGLE_READONLY=1` | `{"provider":"gmail"}`, `{"provider":"drive"}`, or `{"provider":"calendar"}` |
| `github.workflow.source_dispatch` | Dispatch reviewed source-only CI | `THEORG_ENABLE_GITHUB_ACTIONS=1` | `{"expected_sha":"40-character-current-branch-sha"}` |

The GitHub tools require an installed, authenticated official `gh` CLI with appropriate repository scopes and permissions. No credential is requested or stored by the module. GitHub runner status requires the provider to grant the relevant read permission; a 403 is an unavailable result, not proof of Offline status.

The dispatch tool is fixed to `faisalwrokksa-hub/TO`, `bridge-ci.yml`, and `feat/agent-execution-handoffs-independent-qa`. It dispatches `confirm_self_hosted=true`, `build_unsigned_windows_candidate=false`. It compares the full requested commit SHA with the current branch before dispatching. Because branch refs can advance between the check and dispatch, it does not claim race-free execution or completed tests. On uncertain dispatch outcome, it records `needs_review` rather than blindly retrying.

## Windows UI and optional Google integration boundaries

`windows.window.list` uses the local Windows user32 API to enumerate at most 12 visible top-level windows (up to 80 title characters). It does not read window text fields, send input, launch processes, or take screenshots. **Window titles are potentially private data** and are returned only to the approved local caller. `windows.window.focus` requires a fresh, exact window handle, process ID and SHA-256 of the observed title; it checks that identity again and reports whether Windows actually granted focus. It sends no mouse or keyboard input and does not bypass UAC.

`google.readonly.probe` uses fixed official HTTPS GET endpoints for Gmail label metadata, Drive file-list metadata and Calendar list metadata, returning only connection status. No token or returned record content is included in TheOrg's response or SQLite audit. Tokens must be obtained using separately consented Google OAuth flows and provisioned as Generic entries in Windows Credential Manager at `TheOrg/google/gmail-readonly`, `TheOrg/google/drive-readonly`, and `TheOrg/google/calendar-readonly`. TheOrg does **not** automate obtaining/refreshing these tokens; do not copy secrets into prompts or terminal history. The authenticated local `GET /api/integrations` lists the required scopes and always reports unverified status until an individually approved live probe succeeds.

These features are not complete hands-free desktop control, business record editing, or completed external integrations. A user-approved but untested tool still needs runtime and security acceptance on Windows before it is considered reliable.

## Interactive Windows runner lifecycle

`desktop.runner.registration_prompt` and `desktop.runner.start` are **opt-in Windows-only process-launch actions**. They accept only two fixed runner root locations and check for existing `config.cmd`, `run.cmd`, `bin`, `externals`; a symlinked runner root or script is rejected. Registration refuses a pre-existing `.runner` marker, and starting requires it. These actions open a visible standard user console for the official locally installed runner scripts. They **do not download or verify binary provenance**, install services, or request administrator rights; manually validate the installation source before enabling them.

The fresh GitHub registration token is typed **directly into the new console**, never into an API payload, agent transcript, SQLite database or background script. The launch result records a process ID, not a claim that registration succeeded or that GitHub reports Online. Use `github.runner.status` for authenticated confirmation. Launching and registering require independent one-use approval receipts; an uncertain launch is marked `needs_review`, without retries.

## Approved local Windows source checks

`windows.source.verify` requires the operator to set `THEORG_TRUSTED_REPO_DIR` to an **absolute path of a trusted local Git checkout**. No arbitrary path or shell command is taken from an AI instruction. The checkout must match the exact approved commit and have no modified or untracked source files; only generated reports in `out/` are permitted.

The fixed script `tools/Test-TheOrg-Source-Local.ps1` runs with process-scoped `-ExecutionPolicy RemoteSigned` and a five-minute deadline. Test stdout/stderr is discarded, not uploaded or used to construct prompts. Results are accepted only when `out/source-verification/source-results.json` is fresh, valid UTF-8 JSON, refers to the pinned SHA, contains all passed checks, and explicitly confirms source-only work and no deployment. Exit code failure remains failure; ambiguous or interrupted execution needs review and never automatically retries.

This is a trusted **code execution** tool, not a harmless read-only diagnostic. Use an isolated Windows development profile or VM. The product deliberately does not grant unrestricted PowerShell, remote administrator privileges, runner registration, software installation or production release.

`github.workflow.result` independently checks authenticated GitHub run and job metadata for the exact reviewed commit. A successful run header alone is not enough; both the preflight and source-test steps must have succeeded. It does not certify the Windows EXE, external providers or clean-device installation.

## Interaction contract

1. Authenticate with the local TheOrg bearer token (never include token in logs or chat).
2. Call `POST /api/operator/plan` with an instruction. This creates a deterministic **draft only**.
3. Inspect the returned tool IDs, effects and arguments; select one approved action.
4. Call `POST /api/capabilities/prepare` with the selected tool ID and arguments.
5. Review returned SHA-256 digest, expiry and effect. For meaningful side effects, obtain fresh informed user approval.
6. Call `POST /api/capabilities/execute` with request ID, exact digest and `confirmed:true`.
7. Read `GET /api/capabilities/history` for the persisted status; compare any external runner/workflow claims with the authenticated provider.
8. For uncertain or interrupted side effects (`needs_review`), check actual state before proposing another action.

These actions are never run automatically from model output. Model instructions are data, not permissions.

## Remaining development

- Fully permission-controlled Windows UI automation (window identity, mouse, keyboard, downloads, installation, process tree controls) is NOT implemented by this module.
- Runner registration now has an *interactive user-token console handoff* and a registered-runner launch, but no unattended token acquisition, official download verification, software installation, Windows service management, or arbitrary PowerShell.
- P1 browser E2E and P2 business app connectors remain separate development phases.
- Run the full Python/Node suite, real Windows PowerShell, authenticated GitHub API, runner flow and packaged EXE on the same reviewed commit before claiming completion.
- The $0 Actions compute approach, unmerged draft PRs and production `NO_GO` still apply.
