-- Standalone TheOrg Intelligence (NOT THEEPMO) — D1 schema
-- Deploy only after Cloudflare Access is provisioned and company permissions are reviewed.
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS companies (
 tenant_id TEXT NOT NULL, company_id TEXT NOT NULL, name TEXT NOT NULL,
 PRIMARY KEY (tenant_id, company_id)
);
CREATE TABLE IF NOT EXISTS memberships (
 tenant_id TEXT NOT NULL, company_id TEXT NOT NULL, subject TEXT NOT NULL,
 role TEXT NOT NULL CHECK (role IN ('viewer','analyst','executive','reviewer')),
 PRIMARY KEY (tenant_id, company_id, subject),
 FOREIGN KEY (tenant_id,company_id) REFERENCES companies(tenant_id,company_id)
);
CREATE TABLE IF NOT EXISTS kpis (
 tenant_id TEXT NOT NULL, company_id TEXT NOT NULL, metric_id TEXT NOT NULL,
 name TEXT NOT NULL, actual REAL NOT NULL CHECK (actual BETWEEN 0 AND 100),
 target REAL NOT NULL CHECK (target BETWEEN 0 AND 100),
 lower_is_better INTEGER NOT NULL CHECK (lower_is_better IN (0,1)),
 source_ref TEXT NOT NULL, period TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 PRIMARY KEY (tenant_id,company_id,metric_id),
 FOREIGN KEY (tenant_id,company_id) REFERENCES companies(tenant_id,company_id)
);
CREATE TABLE IF NOT EXISTS proposals (
 tenant_id TEXT NOT NULL, company_id TEXT NOT NULL, proposal_id TEXT NOT NULL,
 metric_id TEXT NOT NULL, objective TEXT NOT NULL,
 status TEXT NOT NULL CHECK (status IN ('proposed','approved','qa-reviewed','closed','rejected')),
 created_by TEXT NOT NULL, reviewer_id TEXT,
 evidence_digest TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL,
 PRIMARY KEY (tenant_id,company_id,proposal_id),
 FOREIGN KEY (tenant_id,company_id) REFERENCES companies(tenant_id,company_id)
);
CREATE TABLE IF NOT EXISTS audit_events (
 tenant_id TEXT NOT NULL, company_id TEXT NOT NULL, event_id TEXT NOT NULL,
 proposal_id TEXT NOT NULL, actor TEXT NOT NULL, role TEXT NOT NULL,
 from_status TEXT, to_status TEXT NOT NULL, evidence_digest TEXT,
 timestamp TEXT NOT NULL,
 PRIMARY KEY (tenant_id,company_id,event_id)
);
CREATE INDEX IF NOT EXISTS idx_proposals_company ON proposals(tenant_id,company_id,created_at);
CREATE INDEX IF NOT EXISTS idx_audit_proposal ON audit_events(tenant_id,company_id,proposal_id,timestamp);
