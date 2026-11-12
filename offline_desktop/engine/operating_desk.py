"""Read-only local operating desk for the unified TheOrg engine.

The desk summarizes real SQLite state and suggests a role/route. It never
starts workers, authorizes tools, contacts providers, or exports task content.
"""
from __future__ import annotations
from engine import core, adaptive_runtime

# Only fixed table names may be queried. Never interpolate request input into SQL.
_TABLES = {
    "personal_tasks": ("tasks", "status"),
    "company_jobs": ("company_jobs", "status"),
    "code_plans": ("code_plans", "status"),
    "workflows": ("agent_workflows", "status"),
    "reviewed_solutions": ("adaptive_solutions", "status"),
}


def overview():
    """Return counts and capability evidence, not sensitive prompts or records."""
    with core.conn() as db:
        available = {r["name"] for r in db.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        counts = {}
        for label, (table, col) in _TABLES.items():
            counts[label] = (
                {r["status"]: r["n"] for r in db.execute(
                    f"SELECT {col} AS status, COUNT(*) AS n FROM {table} GROUP BY {col}")}
                if table in available else {}
            )
        counts["chat_sessions"] = int(db.execute("SELECT COUNT(*) FROM chat_sessions").fetchone()[0]) if "chat_sessions" in available else 0
        counts["memories"] = int(db.execute("SELECT COUNT(*) FROM memories").fetchone()[0]) if "memories" in available else 0
    adaptive = adaptive_runtime.readiness()
    # Read-only summary: not a promise that any actual model has generated text.
    return {
        "schema": "theorg-operating-desk-v1", "mode": "local-read-only",
        "adaptive": {"policy": adaptive["choice_mode"], "selected": adaptive["selected"],
                     "auto_reason": adaptive["automatic"]["reason"],
                     "candidate_model": adaptive["automatic"]["model"],
                     "real_inference_verified": False},
        "workspaces": counts,
        "operations": {"personal_tasks": True, "company_agents": "company_jobs" in available,
                       "code_studio": "code_plans" in available,
                       "workflows": "agent_workflows" in available,
                       "reviewed_learning": "adaptive_solutions" in available},
        "permissions": {"tool_approval_required": True, "provider_transfer_approved": False,
                        "model_auto_launch": False, "automatic_learning_promotion": False},
        "no_tasks_executed": True, "no_external_contact": True,
        "note": "Counts are observed local SQLite records; capabilities and model readiness require independent acceptance tests."
    }


def route_preview(instruction, role="supervisor"):
    """Recommend a safe route, never enqueue or execute the instruction."""
    if type(instruction) is not str or not 3 <= len(instruction.strip()) <= 1000:
        raise core.EngineError("Routing instruction must contain 3–1000 characters.")
    if type(role) is not str or role not in core.PROFILES:
        raise core.EngineError("Choose a registered local specialist role.")
    resolution = adaptive_runtime.resolve_preview(instruction.strip())
    action = {
        "reviewed-local-solution": "Read the reviewed solution and confirm it still applies.",
        "optional-local-model": "Explicitly start and probe a compatible local model before creating a task.",
        "manual-external-research-or-model-free-tools": "Use approved local tools, or install a model when hardware permits."
    }[resolution["route"]]
    return {"role": role, "route": resolution["route"], "tier": resolution["tier"],
            "reviewed_solution": resolution["solution"], "recommended_next_action": action,
            "task_enqueued": False, "tools_executed": False,
            "external_provider_contacted": False, "model_called": False,
            "permission_granted": False, "context_included": False}
