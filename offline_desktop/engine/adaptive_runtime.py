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

_CODEBASE = Path(__file__).resolve().parents[1]
# Source repo: root/config; standalone source archive: TheOrg/config;
# frozen EXE: PyInstaller temporary config. Only one canonical file is read.
_CANDIDATES = ([Path(getattr(sys, "_MEIPASS")) / "config" / "adaptive-model-registry.json"]
               if hasattr(sys, "_MEIPASS") else
               [_CODEBASE / "config" / "adaptive-model-registry.json",
                _CODEBASE.parent / "config" / "adaptive-model-registry.json"])
REGISTRY = next((p for p in _CANDIDATES if p.is_file()), _CANDIDATES[0])
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


def preference():
    """User's chosen policy. Auto is the default on new installations."""
    mode = core.setting("adaptive_tier", "auto")
    return mode if mode in (*_TIERS, "auto") else "auto"


def recommend_for_device(total_bytes, available_bytes, models, runtime_present, *, check_headers=True):
    """Side-effect-free choice: real installed GGUF + CPU RAM headroom required.

    Never downloads weights, launches inference, connects remotely or trains.
    This is *not* evidence that the model will successfully run.
    """
    result = {"tier": "nano", "name": "TheOrg Adaptive 1", "model": None,
              "reason": "Model-free fallback; no safely loadable local model.",
              "model_started": False, "auto_download": False, "remote_enabled": False}
    gib = 1024 ** 3
    mib = 1024 ** 2
    if (type(total_bytes) is not int or type(available_bytes) is not int
            or total_bytes <= 0 or available_bytes <= 0):
        result["reason"] = "Available RAM or installed RAM is unknown; using Nano."
        return result
    if not runtime_present:
        result["reason"] = "Compatible local llama.cpp runtime not found; using Nano."
        return result
    candidates = []
    for item in models or []:
        try:
            size, path, name = item.get("bytes"), item.get("path"), item.get("name")
            if (type(size) is not int or not 4096 <= size <= 32*gib
                    or not isinstance(path, str) or not isinstance(name, str)):
                continue
            candidate = Path(path)
            if check_headers:
                if candidate.is_symlink() or not candidate.is_file() or candidate.stat().st_size != size:
                    continue
                with candidate.open("rb") as handle:
                    if handle.read(4) != b"GGUF":
                        continue
            # Conservative CPU-only estimate, including memory reserved for OS.
            required = int(size*1.2 + gib) + 768*mib
            if available_bytes < required:
                continue
            if size <= 2*gib and total_bytes >= 4*gib:
                edition = "lite"
            elif size > 2*gib and total_bytes >= 16*gib:
                edition = "advanced"
            else:
                continue
            candidates.append((edition, size, name, required))
        except (OSError, ValueError, OverflowError, TypeError):
            continue
    if not candidates:
        return result
    advanced = [item for item in candidates if item[0] == "advanced"]
    tier, size, model_name, minimum = min(advanced or candidates, key=lambda item:(item[1],item[2]))
    return {"tier": tier, "name": "TheOrg Adaptive 3" if tier == "advanced" else "TheOrg Adaptive 2",
            "model": model_name, "estimated_bytes_with_reserve": minimum,
            "reason": "Installed GGUF header and estimated CPU RAM pass; inference still unverified.",
            "model_started": False, "auto_download": False, "remote_enabled": False}


def automatic_choice(total_bytes=None, available_bytes=None):
    hardware = device_capabilities.detect(total_bytes=total_bytes, available_bytes=available_bytes)
    return recommend_for_device(hardware.get("total_ram_bytes"),
                                hardware.get("available_ram_bytes"),
                                core.local_models(), bool(core.llama_binary()))


def selected():
    mode = preference()
    return automatic_choice()["tier"] if mode == "auto" else mode


def readiness(available_bytes=None, total_bytes=None):
    details = device_capabilities.detect(total_bytes=total_bytes, available_bytes=available_bytes)
    data = registry()
    auto = recommend_for_device(details.get("total_ram_bytes"),
                                details.get("available_ram_bytes"),
                                core.local_models(), bool(core.llama_binary()))
    mode = preference()
    current = auto["tier"] if mode == "auto" else mode
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
                     "RAM estimate only; an installed model and real inference verification are needed.")
        })
    return {"selected": current, "choice_mode": mode, "automatic": auto,
            "options": options, "hardware": details,
            "fallback": "nano", "automatic_training": False,
            "automatic_web_access": False, "automatic_model_start": False,
            "warning": "Auto selects an edition; it never launches a model or transmits tasks without approval."}


def select(tier):
    if type(tier) is not str or tier not in (*_TIERS, "auto"):
        raise core.EngineError("Choose Auto, Nano, Lite or Advanced.")
    if tier not in ("nano", "auto"):
        option = next(t for t in readiness()["options"] if t["id"] == tier)
        if not option["eligible_by_ram"]:
            raise core.EngineError("Insufficient measured RAM for this edition; Nano remains available.")
    core.set_setting("adaptive_tier", tier)
    core.invalidate_model_probe()
    core.audit("adaptive.edition_selected", {"policy": tier, "resolved": selected()})
    return {"selected": selected(), "choice_mode": tier,
            "inference_verified": False, "no_model_started": True,
            "requires_explicit_model_probe": selected() != "nano"}



def start_recommended(*, confirmed=False):
    """Opt-in model start. Auto tier selection alone never executes a model.

    Recompute current free RAM and installed GGUF files immediately before
    launch, then delegate to core's separate GGUF and RAM preflight checks.
    No model downloads, remote calls, or training are performed.
    """
    if confirmed is not True:
        raise core.EngineError("Explicit permission is required to start the recommended model.")
    if preference() != "auto":
        raise core.EngineError("Enable automatic edition selection first, or start a model manually.")
    choice = automatic_choice()
    if choice["tier"] == "nano" or not choice.get("model"):
        raise core.EngineError("No local model safely meets current RAM and runtime requirements. Adaptive 1 remains active.")
    # A second, independent check prevents a previously recommended filename
    # from bypassing the live preflight at the point of model startup.
    preflight = core.model_start_preflight(choice["model"])
    if not preflight["ram_check_passed"] or not preflight["runtime_available"]:
        raise core.EngineError("Memory or inference-runtime readiness changed. Model start cancelled.")
    metadata = preflight.get("metadata", {})
    if metadata.get("metadata_recognized") is False:
        raise core.EngineError("GGUF metadata verification failed. Model start cancelled.")
    result = core.start_local_model(choice["model"])
    core.audit("adaptive.recommended_model_started", {"edition": choice["tier"],
                                                       "model": choice["model"]})
    return {"edition": choice["tier"], "model": choice["model"], "start": result,
            "inference_verified": False, "requires_real_probe": True}


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
