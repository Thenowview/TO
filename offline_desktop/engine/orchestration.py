"""Persistent, approval-bound agent workflows. No self-executing model or shell tools.

A structured coordinator; agent role and model output do NOT grant authority.
"""
from __future__ import annotations
import json, re, secrets, time
from engine import core, coding

ROLES=('supervisor','planner','developer','qa','security')
STATES=('queued','running','completed','failed','blocked','cancelled','interrupted')
ID=re.compile(r'^[0-9a-f]{20}$')

def init_schema():
    with core.conn() as db:
        db.executescript('''
        CREATE TABLE IF NOT EXISTS agent_workflows(
          id TEXT PRIMARY KEY, project_id TEXT NOT NULL,
          objective TEXT NOT NULL, status TEXT NOT NULL,
          created TEXT NOT NULL, updated TEXT NOT NULL);
        CREATE TABLE IF NOT EXISTS agent_workflow_steps(
          id TEXT PRIMARY KEY, workflow_id TEXT NOT NULL, position INTEGER NOT NULL,
          role TEXT NOT NULL, objective TEXT NOT NULL,
          status TEXT NOT NULL, authorization_deadline REAL,
          evidence TEXT NOT NULL DEFAULT '{}', error TEXT NOT NULL DEFAULT '',
          created TEXT NOT NULL, updated TEXT NOT NULL,
          FOREIGN KEY(workflow_id) REFERENCES agent_workflows(id));
        CREATE INDEX IF NOT EXISTS idx_workflow_steps ON agent_workflow_steps(workflow_id,position);
        ''')
        # Never silently resume an agent workflow, reissue approvals or run tools.
        db.execute("UPDATE agent_workflow_steps SET status='interrupted',authorization_deadline=NULL,error='Interrupted by restart; new authorization required',updated=? WHERE status='running'",(core.utcnow(),))
        db.execute("UPDATE agent_workflows SET status='interrupted',updated=? WHERE id IN (SELECT workflow_id FROM agent_workflow_steps WHERE status='interrupted') AND status='running'",(core.utcnow(),))

def _id(value):
    if not isinstance(value,str) or not ID.fullmatch(value):raise core.EngineError('Invalid workflow identifier.')
    return value

def list_workflows(limit=30):
    if type(limit) is not int or not 1<=limit<=100:raise core.EngineError('Invalid limit.')
    rows=core.records('SELECT * FROM agent_workflows ORDER BY created DESC, id DESC LIMIT ?',(limit,))
    for r in rows:
        r['steps']=core.records('SELECT id,role,position,objective,status,error,created,updated FROM agent_workflow_steps WHERE workflow_id=? ORDER BY position',(r['id'],))
    return rows

def create(project_id,objective,steps):
    coding._project(project_id)  # enforce workspace isolation / project owner
    if not isinstance(objective,str) or not 3<=len(objective.strip())<=1200:raise core.EngineError('Workflow objective must have 3–1200 characters.')
    if not isinstance(steps,list) or not 1<=len(steps)<=8:raise core.EngineError('Workflow must have 1–8 bounded steps.')
    for step in steps:
        if not isinstance(step,dict) or set(step)!={'role','objective'} or step['role'] not in ROLES or not isinstance(step['objective'],str) or not 3<=len(step['objective'].strip())<=1200:
            raise core.EngineError('Each step requires one approved role and bounded objective.')
    ident=secrets.token_hex(10)
    with core.conn() as db:
        db.execute('INSERT INTO agent_workflows VALUES(?,?,?,?,?,?)',(ident,project_id,objective.strip(),'queued',core.utcnow(),core.utcnow()))
        for ix,step in enumerate(steps):
            db.execute('INSERT INTO agent_workflow_steps(id,workflow_id,position,role,objective,status,created,updated) VALUES(?,?,?,?,?,?,?,?)',
                       (secrets.token_hex(10),ident,ix,step['role'],step['objective'].strip(),'queued',core.utcnow(),core.utcnow()))
    core.audit('agent.workflow.created',{'workflow':ident,'project_id':project_id,'roles':[s['role'] for s in steps]})
    return next(row for row in list_workflows(100) if row['id']==ident)

def authorize_step(step_id,deadline_minutes=15):
    _id(step_id)
    if type(deadline_minutes) is not int or not 1<=deadline_minutes<=60:raise core.EngineError('Authorization window must be 1–60 minutes.')
    # No role may move to running if an earlier step is incomplete.
    with core.conn() as db:
        db.execute('BEGIN IMMEDIATE')
        step=db.execute('SELECT * FROM agent_workflow_steps WHERE id=?',(step_id,)).fetchone()
        if not step or step['status']!='queued':raise core.EngineError('Only queued steps can be explicitly authorized.')
        prior=db.execute('SELECT status FROM agent_workflow_steps WHERE workflow_id=? AND position<? ORDER BY position',(step['workflow_id'],step['position'])).fetchall()
        if any(row['status']!='completed' for row in prior):raise core.EngineError('Complete prior workflow steps before authorization.')
        # One running workflow step at a time on constrained devices.
        if db.execute("SELECT 1 FROM agent_workflow_steps WHERE status='running' LIMIT 1").fetchone():
            raise core.EngineError('Another workflow step is running; resource-safe concurrency is one.')
        expiry=time.time()+deadline_minutes*60
        db.execute("UPDATE agent_workflow_steps SET status='running',authorization_deadline=?,updated=? WHERE id=?",(expiry,core.utcnow(),step_id))
        db.execute("UPDATE agent_workflows SET status='running',updated=? WHERE id=?",(core.utcnow(),step['workflow_id']))
    core.audit('agent.workflow.step.authorized',{'step':step_id,'minutes':deadline_minutes})
    return {'step_id':step_id,'status':'running','authorization_deadline':expiry,
            'note':'Authorization is limited to workflow state; no OS or model tools executed.'}

def finish_step(step_id,status,evidence):
    _id(step_id)
    if status not in ('completed','failed','blocked'):raise core.EngineError('Terminal step status must be completed/failed/blocked.')
    if not isinstance(evidence,dict) or len(json.dumps(evidence))>6000:
        raise core.EngineError('Evidence must be a bounded JSON object.')
    if status=='completed' and (not evidence.get('summary') or not isinstance(evidence.get('summary'),str)):
        raise core.EngineError('Completion requires an evidence summary, not model output alone.')
    if evidence.get('executed_tests') is True and not all(k in evidence for k in ('test_count','exit_code','environment','output','source_revision')):
        raise core.EngineError('Executed tests require exact count, exit code, environment, output and revision evidence.')
    expired=False
    with core.conn() as db:
        db.execute('BEGIN IMMEDIATE')
        step=db.execute('SELECT * FROM agent_workflow_steps WHERE id=?',(step_id,)).fetchone()
        if not step or step['status']!='running':raise core.EngineError('Step is not running.')
        if not step['authorization_deadline'] or time.time()>step['authorization_deadline']:
            db.execute("UPDATE agent_workflow_steps SET status='blocked',authorization_deadline=NULL,error='Authorization expired',updated=? WHERE id=?",(core.utcnow(),step_id))
            db.execute("UPDATE agent_workflows SET status='blocked',updated=? WHERE id=?",(core.utcnow(),step['workflow_id']))
            expired=True
        if expired:pass
        else:
            if status=='completed' and step['role']=='developer':
                plan_id=evidence.get('committed_plan_id')
                if not plan_id:raise core.EngineError('Developer completion requires a committed, verified Code Studio plan.')
                plan=coding.get_plan(plan_id)
                if (plan['project_id']!=db.execute('SELECT project_id FROM agent_workflows WHERE id=?',(step['workflow_id'],)).fetchone()['project_id'] or
                    plan['status']!='committed' or not plan['evidence'].get('commit_sha') or
                    not plan['evidence'].get('verified_digest')):
                    raise core.EngineError('Developer claim lacks committed project-scoped test evidence.')
            if status=='completed' and step['role']=='qa' and evidence.get('executed_tests') is not True and evidence.get('review_only') is not True:
                raise core.EngineError('QA completion must be explicitly labeled review-only or include executed tests.')
            db.execute('UPDATE agent_workflow_steps SET status=?,authorization_deadline=NULL,evidence=?,updated=? WHERE id=?',
                   (status,json.dumps(evidence,ensure_ascii=False),core.utcnow(),step_id))
            if status!='completed':final=status
            else:
                pending=db.execute("SELECT 1 FROM agent_workflow_steps WHERE workflow_id=? AND status!='completed' LIMIT 1",(step['workflow_id'],)).fetchone()
                final='queued' if pending else 'completed'
            db.execute('UPDATE agent_workflows SET status=?,updated=? WHERE id=?',(final,core.utcnow(),step['workflow_id']))
    if expired:raise core.EngineError('Step authorization expired; no completion accepted.')
    core.audit('agent.workflow.step.'+status,{'step':step_id,'workflow':step['workflow_id']})
    return {'step_id':step_id,'status':status,'workflow_status':final}

def cancel(workflow_id):
    _id(workflow_id)
    with core.conn() as db:
        db.execute('BEGIN IMMEDIATE')
        w=db.execute('SELECT status FROM agent_workflows WHERE id=?',(workflow_id,)).fetchone()
        if not w or w['status'] in ('completed','cancelled'):raise core.EngineError('Workflow cannot be cancelled.')
        db.execute("UPDATE agent_workflow_steps SET status='cancelled',authorization_deadline=NULL,updated=? WHERE workflow_id=? AND status IN ('queued','running','interrupted')",(core.utcnow(),workflow_id))
        db.execute("UPDATE agent_workflows SET status='cancelled',updated=? WHERE id=?",(core.utcnow(),workflow_id))
    core.audit('agent.workflow.cancelled',{'workflow':workflow_id})
