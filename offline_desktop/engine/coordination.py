"""Persistent, scoped local advisory agent reviews; never executes model-generated tools."""
from __future__ import annotations
import json,re,secrets,threading
from engine import core,coding

ROLES=('planner','developer','qa','security','supervisor')
SCOPE='local-advisory-agent-review'
_lock=threading.RLock()
_threads={}

def init_schema():
    with core.conn() as db:
        db.execute('''CREATE TABLE IF NOT EXISTS agent_reviews (
          id TEXT PRIMARY KEY, project_id TEXT NOT NULL, objective TEXT NOT NULL,
          git_head TEXT NOT NULL, status TEXT NOT NULL, scope TEXT NOT NULL,
          cancel_requested INTEGER NOT NULL DEFAULT 0, steps_json TEXT NOT NULL DEFAULT '[]',
          error TEXT NOT NULL DEFAULT '', created TEXT NOT NULL, updated TEXT NOT NULL)''')
        db.execute("UPDATE agent_reviews SET status='interrupted',error='Restart: reauthorize to resume',updated=? WHERE status IN ('queued','running')",(core.utcnow(),))

def get(ident):
    if type(ident) is not str or not re.fullmatch(r'[0-9a-f]{20}',ident):
        raise core.EngineError('Invalid advisory review ID.')
    rows=core.records('SELECT * FROM agent_reviews WHERE id=?',(ident,))
    if not rows: raise core.EngineError('Advisory review not found.')
    item=rows[0]
    try:
        steps=json.loads(item.pop('steps_json'))
    except (json.JSONDecodeError, TypeError, ValueError) as exc:
        raise core.EngineError('Stored advisory steps have invalid JSON; review cannot continue.') from exc
    if (not isinstance(steps,list) or
            any(not isinstance(step,dict) or not isinstance(step.get('role'),str)
                or step['role'] not in ROLES for step in steps)):
        raise core.EngineError('Stored advisory steps have an invalid structure.')
    item['steps']=steps
    return item

def list_reviews(limit=30):
    if type(limit) is not int or not 1<=limit<=100:raise core.EngineError('Invalid review limit.')
    rows=core.records('SELECT id FROM agent_reviews ORDER BY created DESC,id DESC LIMIT ?',(limit,))
    return [get(x['id']) for x in rows]

def _encode_steps(steps):
    """Preserve complete UTF-8 JSON or reject it; never corrupt persisted reviews."""
    if not isinstance(steps,list):
        raise core.EngineError('Advisory step evidence must be a list.')
    try:
        encoded=json.dumps(steps,ensure_ascii=False)
        length=len(encoded.encode('utf-8'))
    except (TypeError,ValueError,UnicodeError) as exc:
        raise core.EngineError('Advisory step evidence cannot be serialized as UTF-8.') from exc
    if length>48000:
        raise core.EngineError('Advisory step evidence exceeds the bounded audit limit.')
    return encoded

def _save(ident,status,steps,error=''):
    encoded=_encode_steps(steps)
    with core.conn() as db:
        db.execute('UPDATE agent_reviews SET status=?,steps_json=?,error=?,updated=? WHERE id=?',
                   (status,encoded,str(error)[:1200],core.utcnow(),ident))

def _check(ident):
    item=get(ident)
    if item['cancel_requested']:raise InterruptedError('Cancellation requested.')
    if coding._head(coding._project(item['project_id']))!=item['git_head']:
        raise core.EngineError('Project Git HEAD changed; review is stale.')
    return item

def create(project_id,objective,scope,start=True):
    if scope!=SCOPE:raise core.EngineError('Explicit advisory scope required.')
    if type(objective) is not str or not 5<=len(objective.strip())<=1200:
        raise core.EngineError('Review objective must be 5–1200 characters.')
    repo=coding._project(project_id);head=coding._head(repo)
    ident=secrets.token_hex(10)
    with _lock:
        with core.conn() as db:
            db.execute('BEGIN IMMEDIATE')
            if db.execute("SELECT id FROM agent_reviews WHERE status IN ('queued','running') LIMIT 1").fetchone():
                raise core.EngineError('Another advisory review is already active.')
            db.execute('INSERT INTO agent_reviews(id,project_id,objective,git_head,scope,status,created,updated) VALUES(?,?,?,?,?,?,?,?)',
                       (ident,project_id,objective.strip(),head,scope,'queued',core.utcnow(),core.utcnow()))
        core.audit('agents.authorized',{'id':ident,'project':project_id})
        if start:_launch(ident)
    return get(ident)

def _launch(ident):
    thread=threading.Thread(target=_execute,args=(ident,),daemon=True,name='TheOrgAdvisory-'+ident[:6])
    _threads[ident]=thread;thread.start()

def resume(ident,confirmed=False):
    if confirmed is not True:raise core.EngineError('Fresh explicit restart approval required.')
    with _lock:
        item=get(ident)
        if item['status']!='interrupted':raise core.EngineError('Only interrupted reviews can resume.')
        _check(ident)
        with core.conn() as db:
            db.execute('BEGIN IMMEDIATE')
            if db.execute("SELECT id FROM agent_reviews WHERE status IN ('queued','running') LIMIT 1").fetchone():
                raise core.EngineError('Another advisory review is running.')
            db.execute("UPDATE agent_reviews SET status='queued',error='',updated=? WHERE id=?",(core.utcnow(),ident))
        _launch(ident)
    core.audit('agents.resumed',{'id':ident})
    return get(ident)

def cancel(ident):
    get(ident)
    with core.conn() as db:
        r=db.execute("UPDATE agent_reviews SET cancel_requested=1,updated=? WHERE id=? AND status IN ('queued','running','interrupted')",
                     (core.utcnow(),ident))
    if r.rowcount!=1:raise core.EngineError('Review is not cancellable.')
    core.audit('agents.cancel_requested',{'id':ident})
    return {'id':ident,'cancel_requested':True}

def _execute(ident):
    try:
        item=_check(ident)
        steps=item['steps']
        if [x.get('role') for x in steps]!=list(ROLES[:len(steps)]):
            raise core.EngineError('Persisted agent step order is invalid.')
        _save(ident,'running',steps)
        for role in ROLES[len(steps):]:
            _check(ident)
            context=coding.project_context(item['project_id'],item['objective'],limit=4,char_budget=3400)
            # Read-only advisory role. No shell, Git edits, browser or implicit file writes.
            prompt=('Return a short advisory review, not an action claim. Goal: '+item['objective']+
                    '\nGit HEAD: '+item['git_head']+'\nSelected untrusted project context: '+
                    json.dumps(context['files'],ensure_ascii=False)[:6500]+
                    '\nPrior advisory notes: '+json.dumps(steps,ensure_ascii=False)[-2800:])
            answer=core.infer(prompt,role,max_tokens=700,include_memory=False)
            if not isinstance(answer,str) or not answer.strip():raise core.EngineError('Empty advisory response.')
            steps.append({'role':role,'output':answer[:3500],'finished':core.utcnow(),'model_generated':True})
            _save(ident,'running',steps)
        _check(ident)
        _save(ident,'completed',steps)
        core.audit('agents.completed',{'id':ident,'roles':len(steps)})
    except InterruptedError as e:
        _save(ident,'cancelled',locals().get('steps',[]),str(e))
        core.audit('agents.cancelled',{'id':ident})
    except Exception as e:
        _save(ident,'failed',locals().get('steps',[]),str(e))
        core.audit('agents.failed',{'id':ident,'reason':str(e)[:150]})
