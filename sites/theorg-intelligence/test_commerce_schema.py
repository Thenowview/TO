"""Synthetic SQLite tests for the SOURCE-ONLY TheOrg commercial D1 schema.
No account connection, secret, network service or production database.
Run: python -m unittest discover -s sites/theorg-intelligence -p 'test_commerce_schema.py' -v
"""
from pathlib import Path
import sqlite3
import unittest

SCHEMA=Path(__file__).with_name("commerce-private-schema.sql").read_text(encoding="utf-8")
HASH="sha256:"+"a"*64

class CommerceSchemaTests(unittest.TestCase):
    def setUp(self):
        self.db=sqlite3.connect(":memory:")
        self.db.execute("PRAGMA foreign_keys = ON")
        self.db.executescript(SCHEMA)
        self.db.execute("""INSERT INTO commerce_orders(
            id,tenant_id,subject_id,tool_id,currency,amount_cents,input_digest,
            preview_digest,state,created_at,updated_at
        ) VALUES (?,?,?,?,?,?,?,?,?,?,?)""",
        ("ord_1","tenantA","buyer1","project-health","usd",1900,HASH,HASH,
         "pending_payment","2026-11-13T00:00:00Z","2026-11-13T00:00:00Z"))
    def tearDown(self):self.db.close()
    def test_private_owner_index_and_scoped_order(self):
        rows=self.db.execute("SELECT id FROM commerce_orders WHERE tenant_id=? AND subject_id=?",
                             ("tenantA","buyer1")).fetchall()
        self.assertEqual(rows,[("ord_1",)])
        self.assertEqual(self.db.execute("SELECT COUNT(*) FROM commerce_orders WHERE tenant_id=?",
                                         ("tenantB",)).fetchone()[0],0)
    def test_tenant_mismatch_cannot_insert_event(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("""INSERT INTO commerce_events(
             id,tenant_id,order_id,actor_type,actor_id,event_type,created_at
             ) VALUES (?,?,?,?,?,?,?)""",("e","tenantB","ord_1","system","ops","approved","2026-11-13"))
    def test_audit_event_history_is_immutable(self):
        self.db.execute("""INSERT INTO commerce_events(
            id,tenant_id,order_id,actor_type,actor_id,event_type,created_at
            ) VALUES (?,?,?,?,?,?,?)""",("ev1","tenantA","ord_1","server","server1","created","2026-11-13"))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE commerce_events SET event_type=? WHERE id=?",("forged","ev1"))
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM commerce_events WHERE id=?",("ev1",))
    def test_provider_event_replay_cannot_be_recorded_twice(self):
        row=("evt_1","stripe","tenantA","ord_1","checkout.session.completed",HASH,"2026-11-13")
        insert="""INSERT INTO commerce_webhook_receipts(
            provider_event_id,provider,tenant_id,order_id,event_type,payload_sha256,processed_at
        ) VALUES (?,?,?,?,?,?,?)"""
        self.db.execute(insert,row)
        with self.assertRaises(sqlite3.IntegrityError):self.db.execute(insert,row)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("DELETE FROM commerce_webhook_receipts WHERE provider_event_id=?",("evt_1",))
    def test_paid_amount_and_currency_are_bounded(self):
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE commerce_orders SET amount_cents=0 WHERE id='ord_1'")
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute("UPDATE commerce_orders SET currency='btc' WHERE id='ord_1'")
    def test_private_report_pointer_is_tenant_bound(self):
        fields=("rep1","tenantA","ord_1","buyer1","company-a/orders/ord_1/report.html",
                HASH,"html","awaiting_review","2026-11-13")
        sql="""INSERT INTO commerce_reports(
            id,tenant_id,order_id,owner_subject_id,storage_key,sha256_digest,
            format,qa_state,created_at
        ) VALUES (?,?,?,?,?,?,?,?,?)"""
        self.db.execute(sql,fields)
        with self.assertRaises(sqlite3.IntegrityError):
            self.db.execute(sql,("rep2","tenantB","ord_1",*fields[3:]))
        self.assertEqual(self.db.execute("SELECT source_provenance_verified FROM commerce_reports WHERE id=?",
                                         ("rep1",)).fetchone()[0],0)

if __name__=="__main__":unittest.main()
