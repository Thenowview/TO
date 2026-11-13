# TheOrg — local task-to-dashboard pilot (Windows/Node/Python)
**Status:** Source implemented; synthetic integration test committed. NOT connected to the user's PC, local Ollama, or an authenticated Cloudflare enterprise account by this change.

## Current architecture
- Public Workers preview is **static only** with `connect-src 'none'`. It cannot discover, execute, or access local Windows services.
- `local-task-runtime.py` is a separately opt-in loopback-only (`127.0.0.1:8767`) Python/SQLite service. It supports **only** the bounded KPI variance tool today, not arbitrary shell/browser/email agents.
- At least **three distinct strong bearer tokens** must be configured for executive, runtime and independent reviewer. Analyst token is recommended for creating drafts.
- SQLite transaction stores task state and event in one atomic unit; SQL triggers forbid updates/deletions to event history.
- `GET /v1/export` exposes a **company-scoped** task/event bundle **only** to authenticated local callers; no cross-company records or secrets.
- `local-report-cli.mjs` converts that local bundle into 2 executive **draft** reports × HTML/CSV/JSON/Markdown (8 outputs) without uploading anything.
- `operations.html` has an opt-in JSON file import view to display task states locally in the browser. It does not verify the bundle's authenticity and never marks business source evidence verified.

## Quick synthetic validation (no secrets or running service)
Prerequisites: Python 3.11+ and Node 22+, on the same trusted development machine.

```powershell
python sites/theorg-intelligence/local-e2e.py
python -m unittest discover -s sites/theorg-intelligence -p 'test_local_task_runtime.py' -v
node --test sites/theorg-intelligence/local-report-cli.test.mjs
node sites/theorg-intelligence/operations-ui.verify.mjs
```

The e2e test creates a **temporary local SQLite database** and synthetic sample task, passes through create→approve→run→independent review, writes eight report files, verifies that local acceptance does **not** imply source verification, then removes the temporary files.

## Operator-controlled service (not automatically enabled)
1. Create a secrets file **outside this repository** with one JSON object per user, e.g.
   `{"analyst1":{"role":"analyst","token":"<unique-32+-character-secret>","tenant":"demoTenant","company":"demoCompany"},"ceo1":{"role":"executive",...},"worker1":{"role":"runtime",...},"reviewer1":{"role":"reviewer",...}}`.
   Each token must be unique, high entropy, and must **never** be committed or pasted in chat. Set local file permissions restrictively.
2. In an operator-controlled PowerShell session, set `$env:THEORG_LOCAL_IDENTITIES_JSON = Get-Content 'C:\secure\theorg-identities.json' -Raw`, set `$env:THEORG_TASK_DB = 'C:\TheOrgData\theorg-tasks.sqlite3'` and `$env:THEORG_ENABLE_LOCAL_HTTP = 'YES'`.
3. Start the runtime: `python sites/theorg-intelligence/local-task-runtime.py`. It binds only `127.0.0.1:8767` and has **no** Cloudflare Tunnel, inbound remote access or cloud database binding.
4. Use a trusted local HTTP client and the matching Bearer token for each role. The service rejects browser Origin/Fetch-Metadata headers to reduce cross-site request risks.
5. `POST /v1/tasks` with e.g. `{"title":"Review weekly synthetic KPIs","tool":"kpi-variance","inputs":{"rows":[{"name":"Delivery","actual":83,"target":90}]}}` using analyst/executive identity. Record its `id`.
6. `POST /v1/tasks/{id}/approve` using executive token; then `POST /v1/tasks/{id}/run` using runtime token; then `POST /v1/tasks/{id}/accept` using **independent reviewer** token after actually inspecting the output/evidence. The service records the reviewer identity and recalculates the digest. The reviewer still must separately verify the source KPI data.
7. `GET /v1/dashboard` returns counts for that company. `GET /v1/export` returns a JSON bundle with that company's latest 100 tasks and matching (up to 500) audit events. Save it as `local-export.json`, outside the repository.
8. Create standalone local draft reports: `node sites/theorg-intelligence/local-report-cli.mjs C:\TheOrgReports < local-export.json` (use `cmd.exe` for shell input redirection or `Get-Content -Raw local-export.json | node ...` in PowerShell).
9. In the public **preview only with synthetic data**, open `/operations` and select the local JSON export using the **Local task execution & QA dashboard** file input. No browser network requests are made by this module. Do not import confidential customer records into a public preview.

## Mandatory release gates still outstanding
- GitHub Actions runner scheduling/account issue: minimal diagnostic still fails before steps and logs; code changes cannot prove it fixed.
- Real model inference and the Windows Supervisor's native tool runtime are **not** integrated by the synthetic local pilot. Ollama advisory CLI is optional and not an execution authority.
- Enterprise auth/Cloudflare Access and independent D1 storage are unprovisioned. Do not put privileged APIs on public Workers.
- Native DOCX/PPTX/XLSX/PDF export, proof-of-source verification, live EPMO data integrations, and device/user acceptance remain unverified.
- Do not merge PR #25 to `main`, enable automatic Cloudflare production deploy, or bypass checks until GitHub CI and approved browser/hardware QA pass.
