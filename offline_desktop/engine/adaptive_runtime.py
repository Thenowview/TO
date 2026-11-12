"""One TheOrg engine, three optional editions, and reviewed local solution recall.

No dynamic code execution, auto web scraping, credential reads, autonomous
weight training or unreviewed promotion of external AI outputs.
"""
from __future__ import annotations

import json
from pathlib import Path
import re
import secrets
import sys
from engine import core, device_capabilities

REGISTRY = (Path(getattr(sys, "_MEIPASS")) / "config" / "adaptive-model-registry.json"
            if hasattr(sys, "_MEIPASS")
            else Path(__file__).resolve().parents[2] / "config" / "adaptive-model-registry.json")
_TIERS = ("nano", "lite", "advanced")
_MAX_TEXT = 10000
_MAX_RECALL = 5
_TOKEN = re.compile(r"[\w]{3,}", re.UNICODE)


def registry():
    try:
        data = json.loads(REGISTRY.read_text(encoding="utf-8"))
    except (ValueError, OSError) as exc:
        raise core.EngineError("Adaptive model registry unavailable or invalid.") from exc
    tiers = data.get("tiers")
    if data.get("schema") != "theorg-adaptive-registry-v1" or not isinstance(tiers, list):
        raise core.EngineError("Adaptive registry has unexpected structure.")
    if [t.get("id") for t in tiers] != list(_TIERS):
        raise core.EngineError("Adaptive registry tier IDs are not supported.")
    return data


def init_schema():
    with core.conn() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS adaptive_solutions(
            id TEXT PRIMARY KEY, question TEXT NOT NULL, answer TEXT NOT NULL,
            origin TEXT NOT NULL, source_url TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL CHECK(status IN ('candidate','verified','superseded')),
            evidence TEXT NOT NULL DEFAULT '', supersedes TEXT NOT NULL DEFAULT '',
            created TEXT NOT NULL, updated TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS ix_adaptive_solutions_verified
            ON adaptive_solutions(status,updated DESC);
        """)


def selected():
    mode = core.setting("adaptive_tier", "nano")
    return mode if mode in _TIERS else "nano"


def readiness(available_bytes=None, total_bytes=None):
    details = device_capabilities.detect(total_bytes=total_bytes, available_bytes=available_bytes)
    data = registry()
    current = selected()
    options = []
    for tier in data["tiers"]:
        name = tier["id"]
        eligible = bool(name == "nano" or (
            details["total_ram_bytes"] is not None
            and details["total_ram_bytes"] >= tier["min_total_ram_bytes"]
            and details["available_ram_bytes"] is not None
            and details["available_ram_bytes"] >= (1536 if name == "lite" else 6144) * device_capabilities.MIB))
        options.append({
            "id": name, "name": tier["name"], "label": tier["label"],
            "mode": tier["mode"], "eligible_by_ram": eligible,
            "selected": current == name, "weights_included": False,
            "real_inference_verified": False,
            "ready_for_inference": False,
            "platforms": tier["platforms"],
            "note": ("Model-free tools are available on this edition."
                     if name == "nano" else
                     "Estimated RAM fit only; a valid installed GGUF and successful real inference are required.")
        })
    return {"selected": current, "options": options, "hardware": details,
            "fallback": "nano", "automatic_training": False,
            "automatic_web_access": False,
            "warning": "Edition selection is configuration, not proof of inference or a deployable installer."}


def select(tier):
    if tier not in _TIERS or type(tier) is not str:
        raise core.EngineError("Choose Nano, Lite or Advanced.")
    if tier != "nano":
        option = next(t for t in readiness()["options"] if t["id"] == tier)
        if not option["eligible_by_ram"]:
            raise core.EngineError("Insufficient measured RAM for this edition; Nano remains available.")
    core.set_setting("adaptive_tier", tier)
    core.invalidate_model_probe()
    core.audit("adaptive.edition_selected", {"tier": tier})
    return {"selected": tier, "inference_verified": False,
            "no_model_started": True, "requires_explicit_model_probe": tier != "nano"}


def _tokens(value):
    return set(_TOKEN.findall(value.lower()))


def recall(query, limit=_MAX_RECALL):
    if not isinstance(query, str) or not 3 <= len(query.strip()) <= 1000:
        raise core.EngineError("Adaptive recall query must contain 3–1000 characters.")
    if type(limit) is not int or not 1 <= limit <= _MAX_RECALL:
        raise core.EngineError("Invalid recall result count.")
    terms = _tokens(query)
    rows = core.records("""
        SELECT id,question,answer,origin,source_url,evidence,updated
          FROM adaptive_solutions WHERE status='verified'
          ORDER BY updated DESC LIMIT 500
    """)
    matches = []
    for row in rows:
        words = _tokens(row["question"])
        shared = len(terms & words)
        if shared < 1:
            continue
        score = shared / max(1, len(terms | words))
        matches.append((score, row["updated"], row))
    matches.sort(key=lambda x: (x[0], x[1]), reverse=True)
    return {"query": query, "matches": [
        {"id": r["id"], "question": r["question"], "answer": r["answer"],
         "origin": r["origin"], "source_url": r["source_url"],
         "evidence": r["evidence"], "similarity": round(score, 4),
         "verified": True}
        for score, _, r in matches[:limit]],
        "source": "local_reviewed_sqlite_only", "external_search_performed": False,
        "model_called": False, "training_performed": False,
        "note": "Lexical retrieval only; a match is not proof that the solution still applies."
    }


def propose(question, answer, origin="owner", source_url=""):
    if not all(isinstance(v, str) for v in (question, answer, origin, source_url)):
        raise core.EngineError("Solution text and origin must be strings.")
    if not 3 <= len(question.strip()) <= 1000 or not 5 <= len(answer.strip()) <= _MAX_TEXT:
        raise core.EngineError("Solution question or answer has invalid length.")
    if origin not in ("owner", "local-model", "external-agent", "web-source"):
        raise core.EngineError("Invalid knowledge source type.")
    if source_url and (not source_url.startswith("https://") or len(source_url) > 1000):
        raise core.EngineError("Source URLs must be bounded HTTPS links.")
    ident = secrets.token_hex(12)
    now = core.utcnow()
    with core.conn() as db:
        db.execute("""INSERT INTO adaptive_solutions
            (id,question,answer,origin,source_url,status,created,updated)
            VALUES(?,?,?,?,?,'candidate',?,?)""",
            (ident,question.strip(),answer.strip(),origin,source_url,now,now))
    core.audit("adaptive.candidate_created", {"id": ident, "origin": origin})
    return {"id": ident, "status": "candidate", "verified": False,
            "trained_model": False, "automatic_replacement": False}


def candidates(limit=30):
    if type(limit) is not int or not 1 <= limit <= 100:
        raise core.EngineError("Invalid solution list limit.")
    return core.records("""SELECT id,question,origin,status,source_url,evidence,updated
         FROM adaptive_solutions ORDER BY updated DESC LIMIT ?""", (limit,))


def review(ident, *, approved, evidence="", supersedes=""):
    if (type(ident) is not str or not re.fullmatch("[0-9a-f]{24}", ident)
            or type(approved) is not bool or not isinstance(evidence, str)
            or len(evidence.strip()) > 2000
            or type(supersedes) is not str
            or (supersedes and not re.fullmatch("[0-9a-f]{24}", supersedes))):
        raise core.EngineError("Invalid review inputs.")
    if approved and len(evidence.strip()) < 10:
        raise core.EngineError("Promotion requires at least 10 characters of verification evidence.")
    now = core.utcnow()
    with core.conn() as db:
        item = db.execute("SELECT status FROM adaptive_solutions WHERE id=?", (ident,)).fetchone()
        if not item or item["status"] != "candidate":
            raise core.EngineError("Only a pending candidate may be reviewed.")
        if supersedes:
            old = db.execute("SELECT status FROM adaptive_solutions WHERE id=?", (supersedes,)).fetchone()
            if not old or old["status"] != "verified":
                raise core.EngineError("Only a verified solution may be superseded.")
        db.execute("""UPDATE adaptive_solutions SET status=?,evidence=?,supersedes=?,updated=?
             WHERE id=?""", ("verified" if approved else "superseded",evidence.strip(),supersedes,now,ident))
        if approved and supersedes:
            db.execute("UPDATE adaptive_solutions SET status='superseded',updated=? WHERE id=?",
                       (now,supersedes))
    core.audit("adaptive.solution_reviewed", {"id": ident, "approved": approved,
                                             "supersedes": supersedes})
    return {"id": ident, "status": "verified" if approved else "superseded",
            "evidence_recorded": bool(evidence.strip()), "model_trained": False}


def resolve_preview(query):
    """Route locally first; external provider is *never* invoked implicitly."""
    recalled = recall(query)
    strong = next((r for r in recalled["matches"] if r["similarity"] >= 0.55), None)
    if strong:
        route = "reviewed-local-solution"
        result = {"id": strong["id"], "answer": strong["answer"],
                  "evidence": strong["evidence"], "origin": strong["origin"]}
    elif selected() != "nano":
        route = "optional-local-model"
        result = None
    else:
        route = "manual-external-research-or-model-free-tools"
        result = None
    return {"route": route, "solution": result, "tier": selected(),
            "local_recall_matches": len(recalled["matches"]),
            "external_provider_contacted": False, "model_called": False,
            "tools_executed": False, "training_performed": False,
            "external_requires_separate_permission": True,
            "note": ("A stored verified answer may be stale; confirm applicability."
                     if strong else
                     "No sufficiently close verified local solution; choose a separately approved tool or AI provider.")}


def propose_completed_task(task_id):
    """Queue a completed task's answer for owner review; never auto-promote."""
    if type(task_id) is not str or not re.fullmatch("[0-9a-f]{16}", task_id):
        raise core.EngineError("Invalid local task identifier.")
    rows = core.records("SELECT id,prompt,output,status FROM tasks WHERE id=?", (task_id,))
    if len(rows) != 1 or rows[0]["status"] != "completed" or not rows[0]["output"]:
        raise core.EngineError("Only a completed task with actual saved output can become a knowledge candidate.")
    row = rows[0]
    candidate = propose(row["prompt"][:1000], row["output"][:_MAX_TEXT],
                        origin="local-model")
    core.audit("adaptive.task_solution_candidate", {"task_id": task_id, "candidate_id": candidate["id"]})
    return {**candidate, "source_task_id": task_id,
            "requires_independent_owner_review": True}
