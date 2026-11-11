"""TheOrg Code Autopilot v0.7.

Auto-approval is scoped to a single explicit local request, a project created
inside TheOrg's restricted workspace and Docker-only test execution. Nothing
is pushed, deployed, run with host privileges or opened to external networks.
"""
from __future__ import annotations
import json
import secrets
import threading
from engine import core, coding

SCOPED_APPROVAL = 'isolated-local-code-and-tests'
_lock = threading.RLock()
_running: dict[str, threading.Thread] = {}


def init_schema():
    with core.conn() as db:
        db.executescript('''
        CREATE TABLE IF NOT EXISTS code_autopilot_runs (
          id TEXT PRIMARY KEY, project_id TEXT NOT NULL, objective TEXT NOT NULL,
          max_attempts INTEGER NOT NULL, scope TEXT NOT NULL,
          status TEXT NOT NULL, cancel_requested INTEGER NOT NULL DEFAULT 0, history TEXT NOT NULL DEFAULT '[]',
          error TEXT NOT NULL DEFAULT '', created TEXT NOT NULL, updated TEXT NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_autopilot_project ON code_autopilot_runs(project_id,status);
        ''')
        # Never silently resume an execution authorization after a process restart.
        db.execute("UPDATE code_autopilot_runs SET status='interrupted',error='Interrupted by application restart; rerun with fresh authorization',updated=? WHERE status IN ('queued','running')", (core.utcnow(),))


def list_runs(limit=30):
    if not isinstance(limit,int) or limit<1 or limit>100:
        raise core.EngineError('Invalid run limit.')
    rows=core.records('SELECT * FROM code_autopilot_runs ORDER BY created DESC, id DESC LIMIT ?', (limit,))
    for r in rows:
        r['history']=json.loads(r['history'])
    return rows


class Cancellation(Exception):
    pass


def request_cancel(ident):
    if not isinstance(ident,str) or not __import__('re').fullmatch(r'[0-9a-f]{20}',ident):
        raise core.EngineError('Invalid Autopilot run ID.')
    with core.conn() as db:
        result=db.execute("UPDATE code_autopilot_runs SET cancel_requested=1,updated=? WHERE id=? AND status IN ('queued','running')",(core.utcnow(),ident))
    if result.rowcount!=1:
        raise core.EngineError('No active Autopilot run with that ID.')
    core.audit('autopilot.cancel_requested',{'run':ident})
    return {'id':ident,'cancel_requested':True,'note':'Cancellation takes effect at the next safe checkpoint.'}


def _checkpoint(ident):
    rows=core.records('SELECT cancel_requested FROM code_autopilot_runs WHERE id=?',(ident,))
    if not rows or rows[0]['cancel_requested']:
        raise Cancellation('Operator requested a safe stop.')


def _save(ident, status, history, error=''):
    with core.conn() as db:
        db.execute('UPDATE code_autopilot_runs SET status=?,history=?,error=?,updated=? WHERE id=?',
                   (status,json.dumps(history,ensure_ascii=False)[:60000],str(error)[:2000],core.utcnow(),ident))


def authorize(project_id, objective, scope, max_attempts=2, start=True):
    if scope != SCOPED_APPROVAL:
        raise core.EngineError('Automatic execution requires explicit isolated-local-code-and-tests scope.')
    if not isinstance(objective,str) or not 3<=len(objective.strip())<=1200:
        raise core.EngineError('Enter a 3–1200 character coding objective.')
    if type(max_attempts) is not int or not 1 <= max_attempts <= 3:
        raise core.EngineError('Auto-repair attempt limit must be 1–3.')
    coding._project(project_id)
    backend,_ = core.active_backend()
    if not backend:
        raise core.EngineError('Autopilot requires a running LOCAL model. Workspace mode is still available.')
    sandbox=coding.sandbox_status()
    if not sandbox.get('available'):
        raise core.EngineError('Autopilot requires a ready, offline Docker sandbox: '+sandbox.get('reason','not available'))
    ident=secrets.token_hex(10)
    with _lock:
        with core.conn() as db:
            db.execute('BEGIN IMMEDIATE')
            existing=db.execute("SELECT id,project_id FROM code_autopilot_runs WHERE status IN ('queued','running') LIMIT 1").fetchone()
            if existing:
                raise core.EngineError('One Autopilot run is already active. Small devices are limited to one concurrent coding run.')
            db.execute('INSERT INTO code_autopilot_runs(id,project_id,objective,max_attempts,scope,status,created,updated) VALUES(?,?,?,?,?,?,?,?)',
                       (ident,project_id,objective.strip(),max_attempts,scope,'queued',core.utcnow(),core.utcnow()))
        core.audit('autopilot.authorized',{'run':ident,'project':project_id,'scope':scope,'max_attempts':max_attempts})
        if start:
            thread=threading.Thread(target=_execute,args=(ident,project_id,objective.strip(),max_attempts),
                                    daemon=True,name='TheOrgAutopilot-'+ident[:6])
            _running[ident]=thread
            thread.start()
    return {'id':ident,'status':'queued','scope':scope,'max_attempts':max_attempts}


def _execute(ident, project_id, objective, max_attempts):
    history=[]
    previous_id=None
    plan=None
    try:
        _checkpoint(ident)
        _save(ident,'running',history)
        # Verify sandbox again on the worker thread. No local test fallback.
        if not coding.sandbox_status().get('available'):
            raise core.EngineError('Offline sandbox became unavailable before execution.')
        # A passing *pre-edit* test baseline is mandatory. Otherwise a model
        # could receive credit for tests that were already failing and commit
        # an unverified regression. This executes only the detached snapshot.
        baseline=coding._run_tests_sandbox(coding._project(project_id))
        if baseline.get('mode')!='sandbox' or baseline.get('passed') is not True or baseline.get('network') not in ('none', None):
            raise core.EngineError('Existing tests did not pass in the offline sandbox before editing; no code changed.')
        baseline_summary={'passed':True,'exit_code':baseline.get('exit_code'),
                          'image_id':baseline.get('image_id'),
                          'output_tail':str(baseline.get('output',''))[-900:]}
        core.audit('autopilot.baseline_passed',{'run':ident,'project':project_id,'baseline':baseline_summary})
        for attempt in range(1,max_attempts+1):
            _checkpoint(ident)
            if attempt==1:
                plan=coding.generate_with_local_model(project_id,objective)
            else:
                plan=coding.generate_repair_with_local_model(previous_id)
            entry={'attempt':attempt,'plan_id':plan['id'],'digest':plan['digest'],
                   'origin':plan['origin'],'status':'draft','at':core.utcnow(),
                   'baseline':baseline_summary if attempt==1 else None}
            history.append(entry)
            _save(ident,'running',history)
            # Automatic approval binds exact plan digest to the Git HEAD.
            _checkpoint(ident)
            approved=coding.approve(plan['id'],plan['digest'])
            entry['status']='approved';_save(ident,'running',history)
            _checkpoint(ident)
            coding.apply(plan['id'])
            entry['status']='applied';_save(ident,'running',history)
            _checkpoint(ident)
            result=coding.verify(plan['id'],run_tests=True,execution_mode='sandbox')
            entry['status']=result['status']
            entry['test_evidence']=result.get('evidence',{}).get('checks',{})
            _save(ident,'running',history)
            if result['status']=='verified':
                _checkpoint(ident)
                done=coding.commit(plan['id'],'TheOrg Autopilot: '+objective[:75])
                entry['status']='committed'
                entry['commit_sha']=done['evidence']['commit_sha']
                _save(ident,'completed',history)
                core.audit('autopilot.completed',{'run':ident,'commit':entry['commit_sha']})
                return
            # For failed tests, restore original files before model proposes changes.
            coding.rollback(plan['id'])
            entry['status']='rolled_back'
            previous_id=plan['id']
            _save(ident,'running',history)
            if attempt==max_attempts:
                raise core.EngineError('All allowed attempts failed verification; no commit created.')
        raise core.EngineError('Autopilot attempt budget exhausted.')
    except Exception as exc:
        # Best-effort rollback, but never overwrite an independently edited file.
        if plan is not None:
            try:
                current=coding.get_plan(plan['id'])
                if current['status'] in ('applied','checks_failed','verified','interrupted'):
                    coding.rollback(plan['id'])
                    if history:history[-1]['status']='rolled_back'
            except Exception as rollback_error:
                if history:history[-1]['rollback_error']=str(rollback_error)[:500]
        status='cancelled' if isinstance(exc,Cancellation) else 'failed'
        _save(ident,status,history,str(exc))
        core.audit('autopilot.'+status,{'run':ident,'reason':str(exc)[:250]})
    finally:
        with _lock:
            _running.pop(ident,None)
