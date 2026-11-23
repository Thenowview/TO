# GIZE Code Mode — implementation boundary (candidate, 23 November 2026)

## Scope
The local-first Code Mode capability gateway is owned by TO and exposed from code-mode/gateway.mjs. TEBE owns enterprise tenant admission and policy. TEFE is marketing/presentation only; it must not become an agent execution or credential endpoint.

The gateway provides scoped search and execute functions. It does **not** evaluate JavaScript on the local Node/.NET host. Execution remains disabled unless a separately reviewed isolated runner is injected by trusted application code. The test runner is a mock; it is not security evidence. Current native tools and desktop workflows are not automatically connected to this prototype.

## Required isolated runner contract
- Run model-generated JavaScript only inside a hardened process/container or a verified Cloudflare Dynamic Worker (optional, never mandatory for offline operation).
- No ambient filesystem, shell, operating-system credentials, direct network, process spawning or Windows native bridge access from generated code.
- The only outward interface is a bounded host-side callTool(id,args). Re-authorize **every** call through the TO or TEBE authority, including tenant, principal, job, origin, risk, approval and revocation checks.
- Enforce time, CPU, memory, output size and call-count limits inside the actual runtime. The gateway's timeoutMs setting is a request to the runner, not proof it was enforced.
- Keep secrets in the host credential vault, never model prompts, generated code, tool descriptions, sandbox environment variables, console output or .gize/.gaiz job notes.
- External writes need independently verified authorization; privileged execution remains denied in this initial foundation.
- Never equate code success with task completion: verify read-back evidence, persist an audit receipt, and support cancel/recovery without replaying side effects.

## Verification
Run: node --test tests/gize-code-mode.test.mjs
Run existing native bridge, Chrome agent and .gize conformance tests before enabling an execution adapter.
The source-only gateway does not add a public endpoint, deploy a Worker, alter production, or authorize a single external operation.
Existing encrypted exports use .gize; legacy .gaiz artifacts must remain readable under the current codec policy.

## Cross-repository follow-ups
TEBE: integrate read-only capability catalog with trusted server-side tenant authentication, then separately review execution policy and audit persistence.
TEFE: keep public preview read-only until independently verified releases exist.
All three repositories: add actual sandbox/Windows/browser integration tests before release and record source SHA, signed build and rollout evidence.
