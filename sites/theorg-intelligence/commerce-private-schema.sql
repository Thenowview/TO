-- TheOrg COMMERCE SCHEMA: source-only migration, NOT applied to any D1 database.
-- Requires authenticated tenant and customer principal from a verified gateway.
-- Never store raw payment card data, unencrypted confidential report content,
-- Stripe API keys, webhook signing secrets or passwords in this database.
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS commerce_orders (
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL,
 subject_id TEXT NOT NULL,
 tool_id TEXT NOT NULL,
 currency TEXT NOT NULL CHECK(currency='usd'),
 amount_cents INTEGER NOT NULL CHECK(amount_cents>0 AND amount_cents<=99999999),
 input_digest TEXT NOT NULL CHECK(length(input_digest)=71 AND substr(input_digest,1,7)='sha256:'),
 preview_digest TEXT NOT NULL CHECK(length(preview_digest)=71 AND substr(preview_digest,1,7)='sha256:'),
 state TEXT NOT NULL CHECK(state IN (
  'draft','pending_payment','paid_pending_fulfillment','generating',
  'awaiting_review','approved_for_delivery','delivered','cancelled','refunded','failed'
 )),
 provider TEXT NOT NULL DEFAULT 'not-connected',
 provider_session_id TEXT UNIQUE,
 provider_event_id TEXT UNIQUE,
 report_digest TEXT,
 report_status TEXT NOT NULL DEFAULT 'not-generated',
 source_verified INTEGER NOT NULL DEFAULT 0 CHECK(source_verified IN(0,1)),
 qa_accepted INTEGER NOT NULL DEFAULT 0 CHECK(qa_accepted IN(0,1)),
 created_at TEXT NOT NULL,
 updated_at TEXT NOT NULL,
 UNIQUE(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_commerce_orders_owner ON commerce_orders(tenant_id,subject_id,created_at);
CREATE INDEX IF NOT EXISTS idx_commerce_orders_state ON commerce_orders(tenant_id,state,updated_at);

CREATE TABLE IF NOT EXISTS commerce_events (
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL,
 order_id TEXT NOT NULL,
 actor_type TEXT NOT NULL CHECK(actor_type IN ('buyer','server','provider','reviewer','system')),
 actor_id TEXT NOT NULL,
 event_type TEXT NOT NULL,
 previous_state TEXT,
 new_state TEXT,
 external_event_id TEXT UNIQUE,
 evidence_digest TEXT,
 created_at TEXT NOT NULL,
 FOREIGN KEY(tenant_id,order_id) REFERENCES commerce_orders(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_commerce_events_order ON commerce_events(tenant_id,order_id,created_at);
CREATE TRIGGER IF NOT EXISTS commerce_events_no_update BEFORE UPDATE ON commerce_events
BEGIN SELECT RAISE(ABORT,'Commercial event history is append-only'); END;
CREATE TRIGGER IF NOT EXISTS commerce_events_no_delete BEFORE DELETE ON commerce_events
BEGIN SELECT RAISE(ABORT,'Commercial event history is append-only'); END;

-- This references only a PRIVATE object key. Public report URLs do not belong in D1.
CREATE TABLE IF NOT EXISTS commerce_reports (
 id TEXT PRIMARY KEY,
 tenant_id TEXT NOT NULL,
 order_id TEXT NOT NULL UNIQUE,
 owner_subject_id TEXT NOT NULL,
 storage_key TEXT NOT NULL UNIQUE CHECK(length(storage_key)<=240),
 sha256_digest TEXT NOT NULL CHECK(length(sha256_digest)=71 AND substr(sha256_digest,1,7)='sha256:'),
 format TEXT NOT NULL CHECK(format IN ('html','json','csv','md','pdf','docx','xlsx')),
 classification TEXT NOT NULL DEFAULT 'private',
 qa_reviewer_id TEXT,
 qa_state TEXT NOT NULL CHECK(qa_state IN ('draft','awaiting_review','reviewed','rejected')),
 source_provenance_verified INTEGER NOT NULL DEFAULT 0 CHECK(source_provenance_verified IN(0,1)),
 created_at TEXT NOT NULL,
 expires_at TEXT,
 FOREIGN KEY(tenant_id,order_id) REFERENCES commerce_orders(tenant_id,id)
);
CREATE INDEX IF NOT EXISTS idx_commerce_reports_owner ON commerce_reports(tenant_id,owner_subject_id);

-- Event ID is unique and preserves idempotency for provider retries.
CREATE TABLE IF NOT EXISTS commerce_webhook_receipts (
 provider_event_id TEXT PRIMARY KEY,
 provider TEXT NOT NULL CHECK(provider IN ('stripe')),
 tenant_id TEXT NOT NULL,
 order_id TEXT NOT NULL,
 event_type TEXT NOT NULL,
 payload_sha256 TEXT NOT NULL CHECK(length(payload_sha256)=71),
 processed_at TEXT NOT NULL,
 FOREIGN KEY(tenant_id,order_id) REFERENCES commerce_orders(tenant_id,id)
);
CREATE TRIGGER IF NOT EXISTS commerce_webhooks_no_update BEFORE UPDATE ON commerce_webhook_receipts
BEGIN SELECT RAISE(ABORT,'Webhook receipts are append-only'); END;
CREATE TRIGGER IF NOT EXISTS commerce_webhooks_no_delete BEFORE DELETE ON commerce_webhook_receipts
BEGIN SELECT RAISE(ABORT,'Webhook receipts are append-only'); END;

-- Critical release gates NOT implemented by schema alone:
-- 1. Verified identity/JWT middleware must bind tenant_id and subject_id server-side.
-- 2. Webhook processing must verify signed RAW provider payload before D1 writes.
-- 3. Use prepared D1 statements and atomic batch transaction for order+event state.
-- 4. Order state changes require optimistic compare-and-swap and replay tests.
-- 5. R2 bucket must be private; serve downloads only via short-lived customer-scoped authorization.
-- 6. Implement retention/deletion, chargebacks, refunds and external data-provenance verification.
