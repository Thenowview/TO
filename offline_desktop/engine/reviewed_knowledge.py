"""Explicit, local reviewed-knowledge interchange; imports never inherit trust.

This is a user-directed JSON transfer, not sync, remote storage, auto learning,
or proof that a previously reviewed solution is currently correct.
"""
from __future__ import annotations
import hashlib
import json
import re
import secrets
from engine import core, adaptive_runtime

SCHEMA = "theorg-reviewed-knowledge-v1"
MAX_ENTRIES = 12
MAX_BYTES = 120_000
SHA = re.compile(r"[0-9a-f]{64}\Z")
IDENT = re.compile(r"[0-9a-f]{24}\Z")


def _encoded(document):
    return json.dumps(document, ensure_ascii=False, sort_keys=True,
                      separators=(",", ":")).encode("utf-8")


def _digest(document):
    return hashlib.sha256(_encoded(document)).hexdigest()


def export_verified(*, confirmed=False, limit=MAX_ENTRIES):
    if confirmed is not True:
        raise core.EngineError("Explicit consent required: reviewed solutions may contain private text.")
    if type(limit) is not int or not 1 <= limit <= MAX_ENTRIES:
        raise core.EngineError("Knowledge export count must be between 1 and 12.")
    rows = core.records("""SELECT id,question,answer,origin,source_url,evidence,updated
                           FROM adaptive_solutions WHERE status='verified'
                           ORDER BY updated DESC,id DESC LIMIT ?""", (limit,))
    entries = [dict(row) for row in rows]
    document = {"schema": SCHEMA, "trust": "source-verified-only",
                "entries": entries, "contains_memories": False, "contains_credentials": False}
    if len(_encoded(document)) > MAX_BYTES:
        raise core.EngineError("Knowledge is too large for a safe export; reduce the record count.")
    core.audit("knowledge.export_verified", {"count": len(entries)})
    return {"bundle": document, "sha256": _digest(document),
            "warning": "This digest detects accidental changes; it is not a cryptographic signature or proof of provenance."}


def validate_bundle(bundle, sha256):
    if not isinstance(bundle, dict) or type(sha256) is not str or not SHA.fullmatch(sha256):
        raise core.EngineError("A valid JSON knowledge bundle and SHA-256 digest are required.")
    if len(_encoded(bundle)) > MAX_BYTES:
        raise core.EngineError("Knowledge import exceeds 120 KB.")
    if _digest(bundle) != sha256:
        raise core.EngineError("Knowledge bundle digest does not match its content.")
    if set(bundle) != {"schema", "trust", "entries", "contains_memories", "contains_credentials"}:
        raise core.EngineError("Unrecognized knowledge bundle fields.")
    if bundle["schema"] != SCHEMA or bundle["trust"] != "source-verified-only":
        raise core.EngineError("Unsupported knowledge transfer format.")
    if bundle["contains_memories"] is not False or bundle["contains_credentials"] is not False:
        raise core.EngineError("Memory and credential transfer is not supported.")
    entries = bundle["entries"]
    if not isinstance(entries, list) or len(entries) > MAX_ENTRIES:
        raise core.EngineError("Knowledge bundle has too many entries.")
    seen = set()
    for item in entries:
        if not isinstance(item, dict) or set(item) != {
                "id", "question", "answer", "origin", "source_url", "evidence", "updated"}:
            raise core.EngineError("Knowledge record fields are not supported.")
        identifier = item["id"]
        if type(identifier) is not str or not IDENT.fullmatch(identifier) or identifier in seen:
            raise core.EngineError("Invalid or duplicate source record identifier.")
        seen.add(identifier)
        for key in ("question", "answer", "origin", "source_url", "evidence", "updated"):
            if type(item[key]) is not str:
                raise core.EngineError("Knowledge record fields must be text.")
        if not (3 <= len(item["question"].strip()) <= 1000
                and 5 <= len(item["answer"].strip()) <= 10_000
                and len(item["evidence"]) <= 2000
                and len(item["updated"]) <= 80
                and item["origin"] in ("owner", "local-model", "external-agent", "web-source")
                and (not item["source_url"] or
                     (item["source_url"].startswith("https://") and len(item["source_url"]) <= 1000))):
            raise core.EngineError("Invalid or oversized knowledge record.")
    return {"valid": True, "count": len(entries), "trusted_as_verified": False,
            "automatic_tools_authorized": False}


def import_as_candidates(bundle, sha256, *, confirmed=False):
    if confirmed is not True:
        raise core.EngineError("Explicit permission required to import unverified knowledge candidates.")
    result = validate_bundle(bundle, sha256)
    adaptive_runtime.init_schema()
    with core.conn() as db:
        db.execute("""CREATE TABLE IF NOT EXISTS adaptive_import_history(
                      bundle_sha TEXT NOT NULL, source_id TEXT NOT NULL,
                      candidate_id TEXT NOT NULL, created TEXT NOT NULL,
                      PRIMARY KEY(bundle_sha,source_id))""")
        db.execute("BEGIN IMMEDIATE")
        created = 0
        skipped = 0
        for row in bundle["entries"]:
            prior = db.execute("SELECT candidate_id FROM adaptive_import_history WHERE bundle_sha=? AND source_id=?",
                               (sha256, row["id"])).fetchone()
            if prior:
                skipped += 1
                continue
            candidate_id = secrets.token_hex(12)
            now = core.utcnow()
            # Verification evidence is deliberately *not* copied to the candidate.
            # The owner must independently review it before promotion.
            db.execute("""INSERT INTO adaptive_solutions
                (id,question,answer,origin,source_url,status,evidence,created,updated)
                VALUES(?,?,?,?,?,'candidate','',?,?)""",
                (candidate_id,row["question"].strip(),row["answer"].strip(),
                 row["origin"],row["source_url"],now,now))
            db.execute("INSERT INTO adaptive_import_history VALUES(?,?,?,?)",
                       (sha256,row["id"],candidate_id,now))
            created += 1
    core.audit("knowledge.import_candidates", {"count": created, "duplicates_skipped": skipped,
                                               "digest_prefix": sha256[:12]})
    return {**result, "created_candidates": created, "duplicates_skipped": skipped,
            "review_required": True, "automatic_promotion": False, "models_retrained": False}
