"""Versioned company plans for local task routing and context."""
import json
import re

from engine import core


def _schema(db):
    db.execute("""CREATE TABLE IF NOT EXISTS company_plan_versions(
        revision INTEGER PRIMARY KEY, plan TEXT NOT NULL, approved_at TEXT NOT NULL)""")


def current():
    with core.conn() as db:
        _schema(db)
        row = db.execute("SELECT * FROM company_plan_versions ORDER BY revision DESC LIMIT 1").fetchone()
    if not row:
        return {"revision": 0, "plan": None}
    return {"revision": row["revision"], "plan": json.loads(row["plan"]), "approved_at": row["approved_at"]}


def approve(plan, revision, confirmed):
    if confirmed is not True or type(revision) is not int or type(plan) is not dict:
        raise core.EngineError("Review and confirm the company plan.")
    clean = {}
    for key in ("name", "mission", "customers", "constraints"):
        clean[key] = _text(plan.get(key), key)
    for key, fields in (
        ("departments", ("name", "responsibility", "role", "routing_keywords")),
        ("goals", ("outcome", "owner", "measure", "target")),
        ("milestones", ("period", "deliverable", "owner")),
    ):
        items = plan.get(key)
        if not isinstance(items, list) or not 1 <= len(items) <= 20:
            raise core.EngineError("Enter 1–20 " + key + ".")
        if any(type(item) is not dict for item in items):
            raise core.EngineError("Invalid entries in " + key + ".")
        clean[key] = [{field: _text(item.get(field), field) for field in fields} for item in items]
    if any(item["role"] not in core.PROFILES or item["role"] == "supervisor" for item in clean["departments"]):
        raise core.EngineError("Use a registered specialist role for each department.")
    names = {item["name"].casefold() for item in clean["departments"]}
    if len(names) != len(clean["departments"]) or any(
        item["owner"].casefold() not in names for key in ("goals", "milestones") for item in clean[key]
    ):
        raise core.EngineError("Use unique department names and assign every goal and milestone to a department.")
    with core.conn() as db:
        _schema(db)
        db.execute("BEGIN IMMEDIATE")
        latest = db.execute("SELECT COALESCE(MAX(revision),0) FROM company_plan_versions").fetchone()[0]
        if latest != revision:
            raise core.EngineError("The approved plan changed. Reload it before approving another version.")
        db.execute("INSERT INTO company_plan_versions VALUES(?,?,?)",
                   (revision + 1, json.dumps(clean), core.utcnow()))
    return current()


def _text(value, label):
    if not isinstance(value, str) or not 1 <= len(value.strip()) <= 600:
        raise core.EngineError("Enter 1–600 characters for " + label + ".")
    return value.strip()


def route(plan, question):
    if not plan:
        return None
    matches = set()
    for department in plan["departments"]:
        for keyword in department["routing_keywords"].casefold().split(","):
            keyword = keyword.strip()
            if keyword and re.search(r"(?<!\w)" + re.escape(keyword) + r"(?!\w)", question.casefold()):
                matches.add(department["role"])
    return next(iter(matches)) if len(matches) == 1 else None


def context(plan, role):
    if not plan:
        return ""
    departments = [d for d in plan["departments"] if d["role"] == role]
    owners = {d["name"].casefold() for d in departments}
    lines = [f"Approved company plan for {plan['name']}. Mission: {plan['mission']}",
             f"Customers: {plan['customers']}. Constraints: {plan['constraints']}"]
    lines.extend(f"{d['name']}: {d['responsibility']}" for d in departments)
    for goal in plan["goals"]:
        if goal["owner"].casefold() in owners:
            lines.append(f"Goal: {goal['outcome']}. Measure: {goal['measure']}. Target: {goal['target']}")
    for step in plan["milestones"]:
        if step["owner"].casefold() in owners:
            lines.append(f"{step['period']}: {step['deliverable']}")
    return "\n".join(lines)[:1800]
