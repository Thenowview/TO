# TheOrg P0 operator tools — source candidate

**Status:** implemented in review branch, NOT validated as real Windows/GitHub execution.
**Security default:** all new execution flags are disabled. No silent system control.

## Integration points

- `offline_desktop/engine/operator_tools.py`: bounded deterministic preview, Windows read-only inspections, GitHub runner/workflow status, source-only CI dispatch.
- `offline_desktop/engine/capabilities.py`: registered tools, strict argument normalization, single-use 5-minute digest approvals, SQLite audit evidence and restart-aware `needs_review` for uncertain execution.
- `offline_desktop/app.py`: authenticated `POST /api/operator/plan`; no execution performed by preview.
- `offline_desktop/tests/test_operator_tools.py`: synthetic security and state-machine tests with fake GitHub API.
- `offline_desktop/tests/test_api.py`: HTTP authorization and nonexecution tests.

## Available tools

| Name | Effect | Required environment flag | Arguments |
|---|---|---|---|
| `desktop.runner.inspect` | Local known-file inspection | `THEORG_ENABLE_RUNNER_DIAGNOSTICS=1` | `{"location":"user_downloads"}` or `{"location":"system_root"}` |
| `windows.powershell.inspect` | Read-only fixed PowerShell 5.1 script | `THEORG_ENABLE_WINDOWS_INSPECTION=1` | `{"check":"toolchain"}` or `{"check":"powershell_version"}` |
| `github.runner.status` | Authenticated GitHub API read | `THEORG_ENABLE_GITHUB_READONLY=1` | `{}` |
| `github.workflow.status` | Authenticated GitHub API read | `THEORG_ENABLE_GITHUB_READONLY=1` | `{}` |
| `github.workflow.source_dispatch` | Dispatch reviewed source-only CI | `THEORG_ENABLE_GITHUB_ACTIONS=1` | `{"expected_sha":"40-character-current-branch-sha"}` |

The GitHub tools require an installed, authenticated official `gh` CLI with appropriate repository scopes and permissions. No credential is requested or stored by the module. GitHub runner status requires the provider to grant the relevant read permission; a 403 is an unavailable result, not proof of Offline status.

The dispatch tool is fixed to `faisalwrokksa-hub/TO`, `bridge-ci.yml`, and `feat/agent-execution-handoffs-independent-qa`. It dispatches `confirm_self_hosted=true`, `build_unsigned_windows_candidate=false`. It compares the full requested commit SHA with the current branch before dispatching. Because branch refs can advance between the check and dispatch, it does not claim race-free execution or completed tests. On uncertain dispatch outcome, it records `needs_review` rather than blindly retrying.

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
- Runner registration, token acquisition, software installation and arbitrary PowerShell are deliberately NOT provided.
- P1 browser E2E and P2 business app connectors remain separate development phases.
- Run the full Python/Node suite, real Windows PowerShell, authenticated GitHub API, runner flow and packaged EXE on the same reviewed commit before claiming completion.
- The $0 Actions compute approach, unmerged draft PRs and production `NO_GO` still apply.
