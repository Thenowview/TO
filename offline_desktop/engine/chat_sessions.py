"""Local chat-style session organization for independent TheOrg tasks.

Sessions group existing tasks for navigation; they DO NOT inject previous messages
into model context or authorize tools. No provider calls or model-generated titles.
"""
from __future__ import annotations
import secrets
import sqlite3
from engine import core

MAX_TITLE = 100
MAX_SESSIONS = 100
MAX_HISTORY = 100


def init_schema():
    with core.conn() as db:
        db.executescript("""
        CREATE TABLE IF NOT EXISTS chat_sessions (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            created TEXT NOT NULL,
            updated TEXT NOT NULL,
            archived INTEGER NOT NULL DEFAULT 0 CHECK(archived IN (0,1))
        );
        CREATE INDEX IF NOT EXISTS ix_chat_sessions_recent
            ON chat_sessions(archived,updated DESC);
        CREATE TABLE IF NOT EXISTS chat_session_tasks (
            session_id TEXT NOT NULL REFERENCES chat_sessions(id),
            task_id TEXT NOT NULL UNIQUE REFERENCES tasks(id),
            assigned TEXT NOT NULL,
            PRIMARY KEY (session_id,task_id)
        );
        CREATE INDEX IF NOT EXISTS ix_chat_session_tasks_recent
            ON chat_session_tasks(session_id,assigned DESC);
        """)
        columns={r['name'] for r in db.execute('PRAGMA table_info(chat_sessions)').fetchall()}
        if 'include_context' not in columns:
            db.execute('ALTER TABLE chat_sessions ADD COLUMN include_context INTEGER NOT NULL DEFAULT 0')


def _validated_id(value):
    if type(value) is not str or len(value) != 24 or any(c not in "0123456789abcdef" for c in value):
        raise core.EngineError("Invalid local session ID.")
    return value


def _validated_title(value):
    if not isinstance(value, str):
        raise core.EngineError("Session title must be text.")
    clean = " ".join(value.strip().split())
    if not clean or len(clean) > MAX_TITLE:
        raise core.EngineError("Session title must contain 1–100 characters.")
    return clean


def create(title="New session"):
    title = _validated_title(title)
    ident = secrets.token_hex(12)
    now = core.utcnow()
    with core.conn() as db:
        db.execute("INSERT INTO chat_sessions(id,title,created,updated) VALUES(?,?,?,?)",
                   (ident,title,now,now))
    core.audit("chat_session.created", {"id": ident})
    return {"id": ident, "title": title, "created": now,
            "updated": now, "archived": False, "task_count": 0, "include_context": False}


def list_sessions(include_archived=False):
    if type(include_archived) is not bool:
        raise core.EngineError("Invalid archived-session filter.")
    predicate = "" if include_archived else "WHERE s.archived=0"
    return core.records(f"""
        SELECT s.id,s.title,s.created,s.updated,s.archived,s.include_context,
               COUNT(j.task_id) AS task_count
        FROM chat_sessions s LEFT JOIN chat_session_tasks j ON j.session_id=s.id
        {predicate} GROUP BY s.id
        ORDER BY s.updated DESC LIMIT ?
    """, (MAX_SESSIONS,))


def _require_open(db, ident):
    item = db.execute("SELECT id,archived FROM chat_sessions WHERE id=?",(ident,)).fetchone()
    if not item:
        raise core.EngineError("Local session not found.")
    if item["archived"]:
        raise core.EngineError("Archived session is read-only; restore it before adding work.")


def attach_task(session_id, task_id):
    session_id = _validated_id(session_id)
    if type(task_id) is not str or len(task_id)!=16 or any(c not in "0123456789abcdef" for c in task_id):
        raise core.EngineError("Invalid local task ID.")
    with core.conn() as db:
        _require_open(db,session_id)
        exists=db.execute("SELECT id FROM tasks WHERE id=?",(task_id,)).fetchone()
        if not exists:
            raise core.EngineError("Local task not found.")
        linked=db.execute("SELECT session_id FROM chat_session_tasks WHERE task_id=?",(task_id,)).fetchone()
        if linked:
            if linked["session_id"] != session_id:
                raise core.EngineError("Task already belongs to another session.")
            return
        now=core.utcnow()
        db.execute("INSERT INTO chat_session_tasks(session_id,task_id,assigned) VALUES(?,?,?)",
                   (session_id,task_id,now))
        db.execute("UPDATE chat_sessions SET updated=? WHERE id=?",(now,session_id))
    core.audit("chat_session.task_attached",{"session_id":session_id,"task_id":task_id})


def rename(session_id,title):
    session_id=_validated_id(session_id)
    title=_validated_title(title)
    with core.conn() as db:
        _require_open(db,session_id)
        db.execute("UPDATE chat_sessions SET title=?,updated=? WHERE id=?",
                   (title,core.utcnow(),session_id))
    core.audit("chat_session.renamed",{"id":session_id})
    return {"id":session_id,"title":title}


def archive(session_id, archived=True):
    session_id=_validated_id(session_id)
    if type(archived) is not bool:
        raise core.EngineError("Invalid archive state.")
    with core.conn() as db:
        existing=db.execute("SELECT id FROM chat_sessions WHERE id=?",(session_id,)).fetchone()
        if not existing:
            raise core.EngineError("Local session not found.")
        db.execute("UPDATE chat_sessions SET archived=?,updated=? WHERE id=?",
                   (1 if archived else 0,core.utcnow(),session_id))
    core.audit("chat_session.archived" if archived else "chat_session.restored",{"id":session_id})
    return {"id":session_id,"archived":archived}


def session_tasks(session_id):
    session_id=_validated_id(session_id)
    with core.conn() as db:
        existing=db.execute("SELECT id FROM chat_sessions WHERE id=?",(session_id,)).fetchone()
        if not existing:
            raise core.EngineError("Local session not found.")
        return [dict(row) for row in db.execute("""
            SELECT t.id,t.role,t.prompt,t.status,t.output,t.error,t.created,t.updated,
                   CASE WHEN LENGTH(t.context_snapshot)>0 THEN 1 ELSE 0 END AS has_context
            FROM tasks t JOIN chat_session_tasks st ON st.task_id=t.id
            WHERE st.session_id=? ORDER BY st.assigned DESC,t.created DESC LIMIT ?
        """,(session_id,MAX_HISTORY)).fetchall()]


def assigned_task_ids():
    """Allows the UI to show legacy independent tasks separately."""
    return core.records("SELECT task_id,session_id FROM chat_session_tasks")


def set_context(session_id, enabled):
    """Only explicit owner action enables saved-task snippets for future tasks."""
    session_id=_validated_id(session_id)
    if type(enabled) is not bool:
        raise core.EngineError("Conversation context mode must be true or false.")
    with core.conn() as db:
        _require_open(db, session_id)
        db.execute("UPDATE chat_sessions SET include_context=?,updated=? WHERE id=?",
                   (int(enabled),core.utcnow(),session_id))
    core.audit("chat_session.context_changed", {"id":session_id,"enabled":enabled})
    return {"id":session_id,"include_context":enabled,
            "previous_tasks_executed_again":False,"external_tool_approval_granted":False}


def context_for_new_task(session_id):
    """Capture three completed exchanges only; never recall other sessions.

    The user explicitly enables this option. Outputs are untrusted contextual
    snippets, not instructions or proof of correctness.
    """
    session_id=_validated_id(session_id)
    with core.conn() as db:
        record=db.execute("SELECT include_context,archived FROM chat_sessions WHERE id=?",
                          (session_id,)).fetchone()
        if record is None or record["archived"]:
            raise core.EngineError("Session missing or archived; cannot add contextual task.")
        if not record["include_context"]:
            return ""
        rows=db.execute("""
            SELECT t.prompt,t.output,t.id FROM tasks t
            JOIN chat_session_tasks j ON j.task_id=t.id
            WHERE j.session_id=? AND t.status='completed' AND t.output!=''
            ORDER BY j.assigned DESC,t.created DESC LIMIT 3
        """,(session_id,)).fetchall()
    if not rows:
        return ""
    snippets=[]
    for item in reversed(rows):
        # Double-enclosed content cannot grant commands or tool permissions.
        snippets.append(
            "Previous task "+item["id"]+":\n"
            "User request: "+item["prompt"][:350].replace("\x00"," ")+"\n"
            "Model output (unverified): "+item["output"][:650].replace("\x00"," ")
        )
    return "\n\n".join(snippets)[:3200]
