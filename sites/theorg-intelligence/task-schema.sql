-- TheOrg only: additive D1 task execution ledger schema, based on the governance
-- concepts of THEEPMO. Do not apply to THEEPMO database or main app.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS tool_definitions (
 tenant_id TEXT NOT NULL, company_id TEXT NOT NULL,
 tool_id TEXT NOT NULL, version TEXT NOT NULL,
 definition_json TEXT NOT NULL, approved_by TEXT,
 approval_digest TEXT, status TEXT NOT NULL CHECK(status IN ('draft','approved','retired')),
 created_at TEXT NOT NULL,
 PRIMARY KEY(tenant_id,company_id,tool_id,version),
 FOREIGN KEY(tenant_id,company_id) REFERENCES companies(tenant_id,company_id)
);
CREATE TABLE IF NOT EXISTS task_runs (
 tenant_id TEXT NOT NULL,company_id TEXT NOT NULL,task_id TEXT NOT NULL,
 tool_id TEXT NOT NULL,tool_version TEXT NOT NULL,
 title TEXT NOT NULL,owner_id TEXT NOT NULL,
 status TEXT NOT NULL CHECK(status IN ('draft','approved','running','awaiting-qa','accepted','failed','rejected')),
 evidence_digest TEXT,qa_reviewer TEXT,
 results_json TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
 PRIMARY KEY(tenant_id,company_id,task_id),
 FOREIGN KEY(tenant_id,company_id) REFERENCES companies(tenant_id,company_id),
 FOREIGN KEY(tenant_id,company_id,tool_id,tool_version)
 REFERENCES tool_definitions(tenant_id,company_id,tool_id,version)
);
CREATE TABLE IF NOT EXISTS task_events (
 tenant_id TEXT NOT NULL,company_id TEXT NOT NULL,
 event_id TEXT NOT NULL,task_id TEXT NOT NULL,
 event_type TEXT NOT NULL,actor TEXT NOT NULL,actor_role TEXT NOT NULL,
 from_state TEXT,to_state TEXT NOT NULL,
 evidence_digest TEXT,created_at TEXT NOT NULL,
 PRIMARY KEY(tenant_id,company_id,event_id),
 FOREIGN KEY(tenant_id,company_id,task_id)
 REFERENCES task_runs(tenant_id,company_id,task_id)
);
CREATE INDEX IF NOT EXISTS idx_tool_task_scope ON task_runs(tenant_id,company_id,status,created_at);
CREATE INDEX IF NOT EXISTS idx_tool_task_audit ON task_events(tenant_id,company_id,task_id,created_at);
-- Do not grant UPDATE/DELETE privileges on task_events to application identities.
-- D1 does not provide PostgreSQL RLS/GRANT parity; enforce immutable writes through
-- a narrow service and audit trigger in addition to company-scoped query contracts.
CREATE TRIGGER IF NOT EXISTS task_events_no_update
BEFORE UPDATE ON task_events BEGIN SELECT RAISE(ABORT,'immutable task audit'); END;
CREATE TRIGGER IF NOT EXISTS task_events_no_delete
BEFORE DELETE ON task_events BEGIN SELECT RAISE(ABORT,'immutable task audit'); END;
