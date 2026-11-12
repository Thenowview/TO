"""Local project references imported from an authorized EPMO API response."""
import uuid

from engine import core


def schema(db):
    db.execute("""CREATE TABLE IF NOT EXISTS epmo_projects(
        id TEXT PRIMARY KEY, code TEXT NOT NULL, name TEXT NOT NULL,
        status TEXT NOT NULL, progress INTEGER NOT NULL)""")
    db.execute("""CREATE TABLE IF NOT EXISTS epmo_task_links(
        task_id TEXT PRIMARY KEY, project_id TEXT NOT NULL)""")


def import_projects(snapshot, confirmed):
    items = snapshot.get("items") if isinstance(snapshot, dict) else None
    if confirmed is not True or not isinstance(items, list) or not 1 <= len(items) <= 100:
        raise core.EngineError("Provide an authorized EPMO project response with 1–100 projects.")
    rows = []
    for item in items:
        try:
            ident = str(uuid.UUID(item["id"]))
            code, name, status, progress = (item[key] for key in ("code", "name", "status", "progressPct"))
            if not isinstance(code, str) or not 1 <= len(code.strip()) <= 32:
                raise ValueError()
            if not isinstance(name, str) or not 1 <= len(name.strip()) <= 200:
                raise ValueError()
            if status not in ("planning", "active", "on_hold", "closed") or type(progress) is not int or not 0 <= progress <= 100:
                raise ValueError()
        except (ValueError, TypeError, KeyError, AttributeError):
            raise core.EngineError("The snapshot contains an invalid EPMO project.") from None
        rows.append((ident, code.strip(), name.strip(), status, progress))
    with core.conn() as db:
        schema(db)
        db.executemany("""INSERT INTO epmo_projects VALUES(?,?,?,?,?)
            ON CONFLICT(id) DO UPDATE SET code=excluded.code, name=excluded.name,
            status=excluded.status, progress=excluded.progress""", rows)
    return {"imported": len(rows), "has_more_pages": bool(snapshot.get("nextCursor"))}


def link(task_id, project_id, confirmed):
    if confirmed is not True or not isinstance(task_id, str) or not isinstance(project_id, str):
        raise core.EngineError("Confirm the task and EPMO project link.")
    with core.conn() as db:
        schema(db)
        db.execute("BEGIN IMMEDIATE")
        if not db.execute("SELECT 1 FROM tasks WHERE id=?", (task_id,)).fetchone():
            raise core.EngineError("Task not found.")
        if not db.execute("SELECT 1 FROM epmo_projects WHERE id=?", (project_id,)).fetchone():
            raise core.EngineError("Import this EPMO project first.")
        db.execute("""INSERT INTO epmo_task_links VALUES(?,?)
            ON CONFLICT(task_id) DO UPDATE SET project_id=excluded.project_id""", (task_id, project_id))
    return {"task_id": task_id, "project_id": project_id}


def overview():
    with core.conn() as db:
        schema(db)
        projects = db.execute("SELECT * FROM epmo_projects ORDER BY code,id").fetchall()
        links = db.execute("""SELECT l.task_id,l.project_id,t.status FROM epmo_task_links l
            JOIN tasks t ON t.id=l.task_id ORDER BY t.updated DESC""").fetchall()
    return {"projects": [dict(row) for row in projects], "links": [dict(row) for row in links]}
