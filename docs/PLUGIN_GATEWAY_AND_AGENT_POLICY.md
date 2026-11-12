# TheOrg Plugin Gateway and Agent Tool Policy

**Implementation status (12 Nov 2026):** policy registry exists; a narrow, optional read-only Google connection-probe runtime has been committed for Gmail, Drive and Calendar. It requires separately provisioned user credentials in Windows Credential Manager and explicit one-time approval. **No account is connected or live tested; full OAuth onboarding, record operations, MCP client, external writes and business integrations are still incomplete.**

## Principle

TheOrg's 12 fixed agent profiles can be engineered to work with **the categories of capabilities** offered by ChatGPT plugins (research, document editing, GitHub, messaging, cloud services, project planning, etc.) when the same underlying provider supplies separately supported authorization or an approved MCP/API interface.

**Do not claim that an agent can invoke every plugin currently installed inside the owner's ChatGPT account.** ChatGPT-connected plugins, their auth sessions, UI-only actions and internal implementation are not a general-purpose external API. Neither a Chrome tab nor the existence of a ChatGPT connection grants TheOrg access.

Official reference: https://help.openai.com/en/articles/20001256-plugins-in-chatgpt and https://developers.openai.com/plugins/build/mcp-server

## Architecture

```
User order
  ↓
Supervisor & task router
  ├── AI chat consultation: authorized provider / supervised browser handoff
  ├── Agent capability assignment: config/agent-profiles.json
  └── Plugin Gateway
       ├── Local file, document, code and browser tools
       ├── Official provider APIs and per-account OAuth
       ├── Authorized MCP servers (scoped, audited)
       └── Manual handoff for ChatGPT-only / UI-only plugin functions
  ↓
Evidence ledger → independent QA → Supervisor outcome → User
```

## Provider onboarding

1. Discover the provider's **official** API, SDK or documented MCP endpoint.
2. Record capabilities, license, supported operations, account requirements, provider terms, privacy boundary and error-handling expectations.
3. Request a new, minimal authorization for **TheOrg**, separate from any ChatGPT account connection. Store tokens using Windows DPAPI or the Windows credential manager; never commit them.
4. Mark the integration `connected` only after explicit authorization and a successful read-only health check.
5. Match operations to an agent's capabilities; the Supervisor cannot invent or elevate permission from an AI response.
6. Run tool operations through schema validation, rate limits, tenant isolation, allowlists, a bounded timeout, and structured audit logs.
7. Require explicit owner approval for external writes such as sending messages, publishing, sharing, deleting, purchases, deployments, DNS changes and merges.
8. Verify outcomes by reading back provider state or inspecting the real created artifacts. Do not equate a model statement, browser click or hash with business-task completion.
9. Revoke credentials and stop tasks cleanly when the provider connection is lost.

## Access tiers

| Tier | Examples | Execution policy |
| --- | --- | --- |
| Read | Search authorized Drive, read repositories, inspect Cloudflare config | Only with provider authorization; log access |
| Draft | Prepare document, email draft, code patch, work plan | Allowed only inside company scope |
| External write | Send email, post content, create shared calendar event, merge PR, modify DNS | Owner confirmation and audit before execution |
| High risk | Financial transfer, account-security changes, destructive operations, evading access controls | Not supported by default; require a separately reviewed specialized integration or deny |

## 12 permanent profiles

Use `config/agent-profiles.json`. Profiles are **definitions**, not 12 constantly running sessions: each has a department, mission, allowed capabilities, handoff evidence contract, and security boundary.

- Supervisor: coordinates work, grants scoped assignments, requests approvals; never self-certifies.
- Planner / Researcher: task planning and grounded investigation.
- Browser / Desktop / Developer / Analyst / Documents: controlled execution, code, analysis and content production.
- Communications / Integrations: drafts and infrastructure inspection, with gated external actions.
- QA Auditor / Security Officer: independent verification and policy enforcement.

The selected profile can read a plugin's **advertised** capability list, but that alone never makes it authorized or callable.

## Implemented read-only Google probe adapter

`offline_desktop/engine/google_readonly.py` defines three **fixed read-only HTTPS GET probes**, using Windows Credential Manager Generic-credential targets `TheOrg/google/gmail-readonly`, `TheOrg/google/drive-readonly`, and `TheOrg/google/calendar-readonly`. Scoped access tokens must be obtained independently through the provider's official user-consent flow and provisioned in the same restricted Windows account running TheOrg; no token-generation shortcuts or ChatGPT connection reuse are supported.

The scope requested for each provider is shown by the authenticated `GET /api/integrations` endpoint. Until a token is provisioned and an explicit `google.readonly.probe` action is approved with `THEORG_ENABLE_GOOGLE_READONLY=1`, connected status is **unknown**, not Connected. A successful fixed API read confirms that probe only. No mailbox messages, Drive files or calendar event details are returned or saved; no writing, sending, sharing or deletion is supported.

The adapter blocks HTTP redirects and uses fixed hosts/paths, a 12-second deadline and a 32 KiB response limit. Provider failures and expired/insufficiently scoped credentials fail closed. Tokens are never returned to the browser/UI, stored in SQLite or inserted into agent prompts. The browser/app receives only the probe's read-only status and requested scope.

**Additional required work:** secure interactive OAuth authorization and refresh, token revocation UX, granular read/write operations with data minimization, real-provider acceptance tests, rate-limit policy, cost caps and business QA. Do not mark P2 complete based on these health probes.

## Current acceptance gates

- [x] Role policy and connector metadata designs committed
- [x] Narrow Google read-only provider names, scopes, fixed endpoint validation and approval routing added to source (runtime CI not yet run)
- [ ] General-purpose provider registry parser and per-tenant isolation implemented
- [ ] End-to-end provider OAuth onboarding and credential lifecycle implemented (the probe only reads user-provisioned Windows credentials)
- [ ] MCP client and actual tool discovery implemented
- [ ] Approval service and role-policy enforcement integrated with execution
- [ ] Read-back auditing and revocation tests run
- [ ] Live connected-provider test logs recorded

Keep every unavailable integration explicitly labeled unavailable. Never use ChatGPT web UI automation to capture cookies, bypass rate limits, harvest private plugin capabilities, or silently act on connected third-party accounts.
