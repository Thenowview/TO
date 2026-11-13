"""TheOrg task runtime candidate: loopback-only, opt-in, local-first.

Uses Python standard library; not deployed to Cloudflare, not connected to THEEPMO.
Requires a different configured secret per actor/role. No generic shell/browser actions.
"""
from __future__ import annotations
import hmac
import math
import hashlib
import json
import os
import sqlite3
import uuid
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, HTTPServer
from pathlib import Path
from urllib.request import Request, urlopen

HOST = "127.0.0.1"
PORT = 8767
MAX_BODY = 16384
SCHEMA = """
PRAGMA foreign_keys=ON;
CREATE TABLE IF NOT EXISTS tasks(
 id TEXT PRIMARY KEY, tenant TEXT NOT NULL, company TEXT NOT NULL,
 title TEXT NOT NULL, owner TEXT NOT NULL, tool TEXT NOT NULL,
 status TEXT NOT NULL, input_json TEXT NOT NULL, result_json TEXT,
 digest TEXT, reviewer TEXT, created TEXT NOT NULL, updated TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS tasks_scoped ON tasks(tenant,company,created);
CREATE TABLE IF NOT EXISTS events(
 id TEXT PRIMARY KEY, task_id TEXT NOT NULL REFERENCES tasks(id),
 tenant TEXT NOT NULL, company TEXT NOT NULL, actor TEXT NOT NULL,
 action TEXT NOT NULL, previous TEXT, current TEXT NOT NULL, at TEXT NOT NULL,
 evidence_digest TEXT
);
CREATE INDEX IF NOT EXISTS events_scoped ON events(tenant,company,task_id,at);
CREATE TRIGGER IF NOT EXISTS no_update_events BEFORE UPDATE ON events
BEGIN SELECT RAISE(ABORT,'events are immutable'); END;
CREATE TRIGGER IF NOT EXISTS no_delete_events BEFORE DELETE ON events
BEGIN SELECT RAISE(ABORT,'events are immutable'); END;
"""
ROLES = {"analyst", "executive", "runtime", "reviewer", "viewer"}
TOOLS = {"kpi-variance"}
def now():
    return datetime.now(timezone.utc).isoformat()
def sha(obj):
    return "sha256:" + hashlib.sha256(json.dumps(obj, sort_keys=True, separators=(",",":")).encode()).hexdigest()
def token_identities():
    raw = json.loads(os.environ.get("THEORG_LOCAL_IDENTITIES_JSON", "{}"))
    if not isinstance(raw, dict) or len(raw) < 3:
        raise RuntimeError("At least three distinct role identities must be configured")
    identities=[]
    used=set()
    for actor, item in raw.items():
        if not isinstance(item, dict) or not isinstance(actor, str) or len(actor)>64:
            raise RuntimeError("Invalid identity")
        role=item.get("role"); token=item.get("token"); tenant=item.get("tenant"); company=item.get("company")
        if role not in ROLES or not isinstance(token,str) or len(token)<32 or token in used:
            raise RuntimeError("Roles require distinct high-entropy tokens")
        if not all(isinstance(v,str) and v.isascii() and v.replace("_","").replace("-","").isalnum() and 1<=len(v)<=64 for v in [tenant,company]):
            raise RuntimeError("Invalid identity scope")
        used.add(token); identities.append(dict(actor=actor,role=role,tenant=tenant,company=company,token=token))
    roles={item["role"] for item in identities}
    if not {"executive","runtime","reviewer"}.issubset(roles):
        raise RuntimeError("Executive, runtime and independent reviewer identities required")
    return identities
def authorize(headers, identities):
    supplied=headers.get("Authorization","")
    if not supplied.startswith("Bearer ") or len(supplied)>512:
        return None
    token=supplied[7:]
    for ident in identities:
        if hmac.compare_digest(token,ident["token"]):
            return {k:v for k,v in ident.items() if k!="token"}
    return None
def validate_rows(obj):
    if not isinstance(obj,dict) or set(obj)-{"rows"} or not isinstance(obj.get("rows"),list) or not 1<=len(obj["rows"])<=100:
        raise ValueError("Supply between 1 and 100 KPI rows")
    result=[]
    for row in obj["rows"]:
        if not isinstance(row,dict) or not isinstance(row.get("name"),str) or not 1<=len(row["name"])<=80:
            raise ValueError("Invalid metric name")
        a=row.get("actual"); t=row.get("target")
        if type(a) not in (int,float) or type(t) not in (int,float) or not (math.isfinite(a) and math.isfinite(t) and 0<=a<=100 and 0<=t<=100):
            raise ValueError("Invalid metric values")
        result.append({"name":row["name"],"actual":a,"target":t,"variance":round(a-t,2)})
    return result
def connect(db_path):
    db=sqlite3.connect(str(db_path),timeout=5,isolation_level='IMMEDIATE')
    db.row_factory=sqlite3.Row
    db.execute("PRAGMA journal_mode=WAL")
    db.executescript(SCHEMA)
    return db
def events(db, task, identity, action, previous, current, digest=None):
    db.execute("INSERT INTO events VALUES(?,?,?,?,?,?,?,?,?,?)",
        (str(uuid.uuid4()),task["id"],identity["tenant"],identity["company"],
         identity["actor"],action,previous,current,now(),digest))
def create(db, identity, body):
    if identity["role"] not in ("analyst","executive"):
        raise PermissionError("Only analyst or executive creates tasks")
    if not isinstance(body,dict): raise ValueError("Expected object")
    title=body.get("title"); tool=body.get("tool"); inputs=body.get("inputs")
    if not isinstance(title,str) or not 8<=len(title.strip())<=240 or tool not in TOOLS:
        raise ValueError("Invalid title or unsupported tool")
    validate_rows(inputs)
    task_id=str(uuid.uuid4()); at=now()
    with db:
        db.execute("INSERT INTO tasks(id,tenant,company,title,owner,tool,status,input_json,created,updated) VALUES(?,?,?,?,?,?,?,?,?,?)",
           (task_id,identity["tenant"],identity["company"],title.strip(),identity["actor"],tool,"draft",json.dumps(inputs),at,at))
        task={"id":task_id}
        events(db,task,identity,"created",None,"draft")
    return {"id":task_id,"status":"draft","execution_authorized":False}
def get(db,identity,task_id):
    row=db.execute("SELECT * FROM tasks WHERE id=? AND tenant=? AND company=?",
                   (task_id,identity["tenant"],identity["company"])).fetchone()
    if row is None: raise KeyError("Task not found")
    return dict(row)
def move(db,identity,task_id,action):
    task=get(db,identity,task_id)
    transitions={
      "approve":("draft","approved","executive"),
      "run":("approved","awaiting-qa","runtime"),
      "accept":("awaiting-qa","accepted","reviewer"),
      "reject":("awaiting-qa","rejected","reviewer")
    }
    if action not in transitions: raise ValueError("Unsupported action")
    previous,nxt,role=transitions[action]
    if identity["role"]!=role or task["status"]!=previous:
        raise PermissionError("Role or state gate rejected")
    if action=="accept":
        if identity["actor"]==task["owner"]:
            raise PermissionError("Independent reviewer required")
        result=json.loads(task["result_json"] or "null")
        if not result or not hmac.compare_digest(sha(result),task["digest"] or ""):
            raise ValueError("Evidence digest invalid")
        if body_truth(result) is False: raise ValueError("Missing result")
    update={}
    if action=="run":
        rows=validate_rows(json.loads(task["input_json"]))
        output={"mode":"deterministic-offline","tool":task["tool"],
                "rows":rows,"mean_variance":round(sum(r["variance"] for r in rows)/len(rows),2),
                "source_verified":False,"model_calls":0,"external_actions":0}
        update={"result_json":json.dumps(output,sort_keys=True),"digest":sha(output)}
    if action=="accept":update["reviewer"]=identity["actor"]
    with db:
        query="UPDATE tasks SET status=?,updated=?"+("".join(", "+k+"=?" for k in update))+" WHERE id=? AND status=? AND tenant=? AND company=?"
        values=[nxt,now(),*update.values(),task_id,previous,identity["tenant"],identity["company"]]
        cursor=db.execute(query,values)
        if cursor.rowcount!=1:raise ValueError("Concurrent state change")
        events(db,task,identity,action,previous,nxt,update.get("digest",task["digest"]))
    return {"id":task_id,"status":nxt,"reviewed":action=="accept","source_verified":False}
def body_truth(value): return isinstance(value,dict) and bool(value.get("rows"))
def evidence_for_review(db, identity, task_id):
    """Read-only evidence for reviewer/executive; never returns source secrets."""
    if identity["role"] not in ("reviewer","executive"):
        raise PermissionError("Evidence review role required")
    task=get(db,identity,task_id)
    if task["status"] not in ("awaiting-qa","accepted","rejected"):
        raise PermissionError("Evidence not ready for review")
    result=json.loads(task["result_json"] or "null")
    if not body_truth(result):
        raise ValueError("No evidence available")
    digest=sha(result)
    return {
        "task_id":task["id"],"title":task["title"],"tool":task["tool"],
        "company":identity["company"],"tenant":identity["tenant"],
        "status":task["status"],"stored_digest":task["digest"],
        "recomputed_digest":digest,
        "integrity_matches":hmac.compare_digest(task["digest"] or "",digest),
        "result":result,"source_provenance_verified":False,
        "warning":"Local evidence integrity does not establish authenticity of source records"
    }

def list_tasks(db,identity):
    rows=db.execute("SELECT id,title,tool,status,digest,created,updated,reviewer FROM tasks WHERE tenant=? AND company=? ORDER BY created DESC LIMIT 100",
                    (identity["tenant"],identity["company"])).fetchall()
    return [dict(r) for r in rows]
def dashboard(db,identity):
    tasks=list_tasks(db,identity)
    accepted=sum(t["status"]=="accepted" for t in tasks)
    return {"tenant":identity["tenant"],"company":identity["company"],"task_total":len(tasks),
            "accepted":accepted,"not_verified":len(tasks)-accepted,
            "by_status":{k:sum(t["status"]==k for t in tasks) for k in ["draft","approved","awaiting-qa","accepted","rejected"]},
            "ai_model_calls":0,"external_actions":0,
            "source_evidence_verified":False,"mode":"local-deterministic",
            "warning":"Task acceptance verifies integrity and reviewer identity, not external KPI truth"}
def export_bundle(db, identity):
    """Owner-authorized local export; never a public synchronization endpoint."""
    tasks=list_tasks(db,identity)
    ids=[t["id"] for t in tasks]
    if ids:
        placeholders=",".join("?" for _ in ids)
        events_rows=db.execute(
            "SELECT id,task_id,actor,action,previous,current,at,evidence_digest "
            "FROM events WHERE tenant=? AND company=? AND task_id IN ("+placeholders+") ORDER BY at,id LIMIT 500",
            (identity["tenant"],identity["company"],*ids)
        ).fetchall()
    else:
        events_rows=[]
    return {
        "schema_version":"theorg-local-bundle-1",
        "exported_at":now(),
        "tenant":identity["tenant"],"company":identity["company"],
        "source":"operator-controlled-local-runtime",
        "source_provenance_verified":False,
        "cloud_sync":False,
        "tasks":[{"id":t["id"],"title":t["title"],"tool":t["tool"],
                  "status":t["status"],"digest":t["digest"],"reviewer":t["reviewer"],
                  "created":t["created"],"updated":t["updated"]} for t in tasks],
        "events":[dict(r) for r in events_rows],
        "warning":"Local acceptance verifies evidence integrity and reviewer identity only; business source provenance is unverified"
    }

def model_advisory(prompt,model):
    """Optional human-initiated Ollama advisory. Its output is never approval/evidence."""
    if os.environ.get("THEORG_ENABLE_OLLAMA")!="YES" or not isinstance(model,str) or not 1<=len(model)<=80 or not all(c.isalnum() or c in ".:_-" for c in model):
        raise PermissionError("Local Ollama advisor not enabled or invalid model")
    if not isinstance(prompt,str) or not 1<=len(prompt)<=3000: raise ValueError("Prompt size invalid")
    data=json.dumps({"model":model,"prompt":"Advisory draft only; never claim execution.\n"+prompt,
                     "stream":False,"options":{"num_predict":450}}).encode()
    request=Request("http://127.0.0.1:11434/api/generate",data=data,
                    headers={"Content-Type":"application/json"},method="POST")
    with urlopen(request,timeout=25) as resp:
        if resp.status!=200: raise RuntimeError("Ollama unavailable")
        result=json.loads(resp.read(65536))
    return {"advisory_only":True,"verified":False,"model":model,"text":str(result.get("response",""))[:8000]}

class Service(BaseHTTPRequestHandler):
    server_version="TheOrgLocal/0.1"
    def reply(self,status,body):
        payload=json.dumps(body).encode()
        self.send_response(status)
        self.send_header("Content-Type","application/json")
        self.send_header("Cache-Control","no-store")
        self.send_header("X-Content-Type-Options","nosniff")
        self.send_header("Content-Length",str(len(payload)))
        self.end_headers();self.wfile.write(payload)
    def identity(self):
        if self.headers.get("Host") not in ("127.0.0.1:8767","localhost:8767"): return None
        if self.headers.get("Origin") or self.headers.get("Sec-Fetch-Site"): return None
        return authorize(self.headers,self.server.identities)
    def handle_action(self):
        identity=self.identity()
        if not identity: return self.reply(401,{"error":"Unauthorized"})
        path=self.path.split("?")[0]
        if "?" in self.path: return self.reply(400,{"error":"Query strings not supported"})

        if self.command=="GET":
            if path=="/v1/health":return self.reply(200,{"status":"ready","mode":"loopback-only","cloud_sync":False})
            if path=="/v1/tasks":return self.reply(200,{"tasks":list_tasks(self.server.db,identity)})
            if path=="/v1/dashboard":return self.reply(200,dashboard(self.server.db,identity))
            if path=="/v1/export":return self.reply(200,export_bundle(self.server.db,identity))
            if path.startswith("/v1/tasks/") and path.endswith("/evidence"):
                parts=path.split("/")
                if len(parts)==5 and parts[-1]=="evidence":
                    try: return self.reply(200,evidence_for_review(self.server.db,identity,parts[3]))
                    except PermissionError as error: return self.reply(403,{"error":str(error)})
                    except KeyError: return self.reply(404,{"error":"Task not found"})
                    except (ValueError,TypeError) as error: return self.reply(400,{"error":str(error)})
            return self.reply(404,{"error":"Not found"})
        try: length=int(self.headers.get("Content-Length","0") or "0")
        except (ValueError,OverflowError):return self.reply(400,{"error":"Invalid content length"})
        if not 0<length<=MAX_BODY:return self.reply(413,{"error":"Invalid body length"})
        try:
            body=json.loads(self.rfile.read(length))
            if not isinstance(body,dict):return self.reply(400,{"error":"Expected JSON object"})
        except (ValueError,UnicodeDecodeError):return self.reply(400,{"error":"Invalid JSON"})
        try:
            if path=="/v1/tasks" and self.command=="POST":return self.reply(201,create(self.server.db,identity,body))
            if path.startswith("/v1/tasks/") and self.command=="POST":
                parts=path.split("/")
                if len(parts)!=5 or parts[-1] not in ("approve","run","accept","reject"):return self.reply(404,{"error":"Not found"})
                if parts[4]=="accept":
                    evidence=evidence_for_review(self.server.db,identity,parts[3])
                    if body.get("review_confirmed") is not True or not isinstance(body.get("evidence_digest"),str) or not hmac.compare_digest(body["evidence_digest"],evidence["stored_digest"] or "") or not evidence["integrity_matches"]:
                        raise PermissionError("Explicit reviewer acknowledgement of matching evidence digest is required")
                return self.reply(200,move(self.server.db,identity,parts[3],parts[4]))
            if path=="/v1/ai/advice" and self.command=="POST":
                if identity["role"] not in ("analyst","executive"):raise PermissionError("Role denied")
                return self.reply(200,model_advisory(body.get("prompt"),body.get("model")))
            return self.reply(404,{"error":"Not found"})
        except PermissionError as error:return self.reply(403,{"error":str(error)})
        except KeyError:return self.reply(404,{"error":"Task not found"})
        except (ValueError,TypeError) as error:return self.reply(400,{"error":str(error)})
        except Exception:return self.reply(503,{"error":"Execution unavailable"})
    def do_GET(self):self.handle_action()
    def do_POST(self):self.handle_action()
    def log_message(self,fmt,*args):pass

def main():
    if os.environ.get("THEORG_ENABLE_LOCAL_HTTP")!="YES":
        raise SystemExit("Disabled. Set THEORG_ENABLE_LOCAL_HTTP=YES explicitly.")
    identities=token_identities()
    raw_location=Path(os.environ.get("THEORG_TASK_DB","theorg-tasks.sqlite3")).expanduser()
    if raw_location.is_symlink():raise SystemExit("Refuse symlink database")
    location=raw_location.resolve()
    location.parent.mkdir(parents=True,exist_ok=True)
    db=connect(location)
    srv=HTTPServer((HOST,PORT),Service)
    srv.identities=identities;srv.db=db
    print("TheOrg local task runtime: loopback only, opt-in, no public Cloudflare connection",flush=True)
    srv.serve_forever()

if __name__=="__main__":main()
