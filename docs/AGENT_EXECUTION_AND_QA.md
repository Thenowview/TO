# TheOrg — OpenCode execution, inter-agent handoffs, and QA (draft PR #23)

**Status:** source integration candidate, review-only. Not a verified 10/10 desktop agent system. No main merge, release, provider login or production deployment.

## External runtime

OpenCode: https://opencode.ai/docs/cli/commands
Open source/license: https://github.com/anomalyco/opencode

TheOrg invokes the documented OpenCode CLI with an exact user-selected provider/model identifier and JSON output. The OpenCode binary is installed separately or optionally bundled from an independently checksum-verified official Windows CLI ZIP. TheOrg never silently installs the runtime or copies user credentials. Provider access and any usage costs remain under the user's separate account.

## Flow

Owner instruction → SQLite company order → ordered agent tasks and explicit dependencies → approved OpenCode dispatch → copied source workspace → source hashes and report → separate optional AI QA advisory → independent QA/security attestation → dependency handoff message → optional Code Studio draft diff → separately approved apply, verify, commit → company results export.

### Core behavior

- Company project binding: a Code Studio project belongs to the first company that creates an order for it. Attempted cross-company reuse is rejected.
- Ordered task dependencies reference earlier tasks; all predecessors must reach QA-accepted state before downstream dispatch.
- Maximum four local OpenCode agent or QA processes running simultaneously. The Chrome provider queue is separate, so a cross-runtime unified limit is not yet implemented.
- TheOrg stages bounded text source, max 240 files, 8 MiB total and 256 KiB per file. It excludes hidden paths, obvious credentials, Git internals, node_modules and symlinks.
- Model output and handoff payloads are always untrusted and cannot grant permissions.
- OpenCode V2 rule configuration uses the current ordered `permissions` array and action names (`shell`, `subagent`, `execute`); do not substitute older V1 `permission`/`bash` syntax. The adapter now checks the CLI `--version` and refuses unverified V2 binaries before execution. This is a fail-closed compatibility guard, **not** proof that the installed runtime honors every policy; a real CLI integration test is still required.
- Source-only read-only runs that modify any copied source file are marked **failed**, even if the CLI exits with status zero. Structured provider error events and files or symlinks outside the approved output inventory also prevent submission for QA.
- OpenCode timeouts attempt to terminate the child process tree, with best-effort semantics (not a process-isolation guarantee).
- Source verification, AI QA, Code Studio drafts and exports must use the exact company/order/job/attempt path; absent paths, external paths and symlinked parents are rejected. QA cannot scan the desktop working directory when an attempt path is missing.
- OpenCode V2 permission policy denies shell commands, Code Mode execution, external directories, web search/fetch, skills and subagents. Developer isolated-edit jobs may modify the COPY, never the original project.
- **Important:** OpenCode runs as a native process under the signed-in OS user. Its config rules are not OS isolation. Use a VM/container to handle untrusted code and avoid sensitive workspace material.
- External provider transfer is expressly authorized separately on each dispatch; model costs, provider privacy and credentials remain external.
- Running jobs become interrupted on restart, and are not silently retried. A new attempt requires requeue plus fresh dispatch approval.
- Owners may now request cancellation of a live OpenCode execution. The worker receives a cancellation event, attempts to stop the OpenCode child process tree, and only then records `cancelled`; an initial cancellation request does **not** imply the process has stopped. Queued/interrupted work can be cancelled without launching any process. The local process running under the user's OS is not a secure sandbox.
- Independent AI QA launches a separate read-only model session and saves advisory findings, but does not self-approve.
- Separate QA/security verdicts require evidence and structural-hash integrity. Human reviewer identity is self-attested, not independently authenticated.
- Accepted developer output can be converted into a Code Studio DRAFT if original file hashes match. Existing Code Studio digest, apply, testing and local commit controls remain mandatory; no automatic merge or push.
- Accepted outputs export into company/order-specific directories, with exact SHA-256 receipts. No outputs are executed during export.

### Windows paths

- Engine state: %LOCALAPPDATA%\TheOrg\EngineData
- Local project: %LOCALAPPDATA%\TheOrg\workspace\projects\<slug>
- Attempt copy: %LOCALAPPDATA%\TheOrg\workspace\theorg_agent_runs\<company>\<order>\<job>\<attempt>
- Company results: %LOCALAPPDATA%\TheOrg\workspace\companies\<company>\orders\<order>\results

## UI procedure

1. In Code Studio, create an isolated demo project.
2. Open Company agents, choose the project, enter company ID (e.g., demo), objective, and ordered JSON task plan.
3. Example JSON:

~~~json
[
  {"role":"planner","instruction":"Review project and propose a scoped plan.","mode":"read_only"},
  {"role":"developer","instruction":"Implement a small change in the isolated copy.","mode":"isolated_edit","depends_on":[0]},
  {"role":"qa","instruction":"Independently identify evidence gaps and defects.","mode":"read_only","depends_on":[1]}
]
~~~

4. Create order; this creates a queue, not external execution.
5. Select an authorized OpenCode provider/model. Approve data transfer and any isolated edit before dispatch. Active jobs have a separately confirmed **Stop running agent** action; use it to request process-tree termination, then inspect the final status before retrying.
6. Inspect returned source hashes and output. Optionally request independent read-only AI QA. Sign a separate QA/security acceptance only after checking actual evidence.
7. Accepted jobs send untrusted handoffs to downstream roles; dispatch later jobs with a new approval.
8. For accepted developer edits, create a Code Studio draft. Review the exact source diff and approve its digest only when satisfied.
9. Export accepted results into the company workspace; no hidden application of code.

## Authenticated local endpoints

GET: /api/company/runtime, /api/company/orders?company_id=demo, /api/company/messages?order_id=<id>, /api/company/qa?job_id=<id>, /api/company/qa/structural?job_id=<id>.

POST (JSON with confirmed=true): /api/company/orders, /api/company/jobs/dispatch, /api/company/jobs/propose, /api/company/jobs/cancel, /api/company/jobs/requeue, /api/company/jobs/export, /api/company/messages, /api/company/qa/run, /api/company/qa/review.

The local Bearer API token and loopback server are not designed for public networking.

## Optional OpenCode Windows CLI bundling

After independently checking source and the release digest of an official OpenCode Windows CLI ZIP, use the local builder:

~~~powershell
$cli = "C:\VerifiedDownloads\opencode-cli-win-x64.zip"
$sha = (Get-FileHash -LiteralPath $cli -Algorithm SHA256).Hash
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\Build-TheOrg-Windows-Local.ps1 -OpenCodeArchive $cli -OpenCodeSha256 $sha
~~~

A local hash alone does not prove authenticity. Preserve required open-source copyright/license notices when distributing. Actual GGUF weights and Chrome archives remain optional inputs. Building TheOrg does not certify the third-party model or browser archive.

## Final acceptance campaign — after integration

- Python source tests: malformed inputs, company isolation, dependency rules, concurrent slot exhaustion, crash recovery, export path safety and approvals; synthetic regressions for read-only file mutation, structured provider errors, invalid staging locations, owner cancellation and prelaunch refusal. Added tests are not a claim that CI or Windows integration passed.
- Static JS syntax, dashboard element references, full UI navigation.
- Real OpenCode V2 CLI command and policy enforcement on a synthetic project.
- Model produces a real read-only response, then an isolated source change; original source untouched.
- Independent AI QA produces a separate advisory record without changing source.
- Human QA approves evidence; dependency-unlocking handoff is delivered exactly once.
- Accepted code creates a Code Studio draft; explicit digest approval, apply, test and rollback succeed.
- Company result exports exist and have correct file hashes.
- Restart preserves jobs and never automatically re-sends API requests.
- Windows self-contained executable works without Python or .NET SDK on the destination PC.
- Real GGUF inference and ChatGPT/Claude browser automation are independently tested, permissions and data controls reviewed, no unresolved security defects.

Current GitHub-hosted Windows Actions on parent PR #22 fail before job steps start; this prevents any production certification until the runner issue is resolved or local Windows acceptance succeeds.
