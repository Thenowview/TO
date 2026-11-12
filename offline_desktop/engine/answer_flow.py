"""Local-first task resolution, reviewed learning and recoverable cache cleanup.

Answers never execute tools. New answers enter a review queue, not trusted recall.
Reviewed answers still require an applicability check before closure.
"""
from __future__ import annotations
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import time
from engine import core, adaptive_runtime, online_provider, office_agents


def init_schema():
    adaptive_runtime.init_schema()
    office_agents.init_schema()
    with core.conn() as db:
        db.execute('''CREATE TABLE IF NOT EXISTS answer_flow(
            task_id TEXT PRIMARY KEY,stage TEXT NOT NULL,route TEXT NOT NULL DEFAULT '',
            candidate_id TEXT NOT NULL DEFAULT '',note TEXT NOT NULL DEFAULT '',
            updated TEXT NOT NULL)''')
        db.execute('''CREATE TABLE IF NOT EXISTS answer_reviews(
            task_id TEXT PRIMARY KEY,answer TEXT NOT NULL,source_url TEXT NOT NULL DEFAULT '',
            lesson TEXT NOT NULL DEFAULT '',evidence TEXT NOT NULL DEFAULT '',
            status TEXT NOT NULL DEFAULT 'pending')''')


def policy():
    return {'enabled': core.setting('answer_flow_enabled', os.environ.get('THEORG_ADAPTIVE_FLOW', '1' if core.FROZEN else '0')) == '1',
            'online_fallback': core.setting('answer_online_fallback', '0') == '1',
            'auto_load': core.setting('answer_auto_load', '1') == '1',
            'temporary_cleanup': core.setting('answer_temporary_cleanup', '1') == '1',
            'learning': 'reviewed-memory-only', 'weight_training': False,
            'provider': online_provider.status(), 'tier': adaptive_runtime.selected(),
            'closure':'evidence-and-owner-review', 'employees':['Manager','Assigned worker','Reviewer'],
            'automatic_browser_chat_reading':False}


def configure(options, *, confirmed=False):
    if confirmed is not True or type(options) is not dict:
        raise core.EngineError('Confirm the answer-flow settings change.')
    allowed = {'enabled', 'online_fallback', 'auto_load', 'temporary_cleanup'}
    if not options or set(options) - allowed or any(type(v) is not bool for v in options.values()):
        raise core.EngineError('Invalid answer-flow settings.')
    names = {'enabled': 'answer_flow_enabled', 'online_fallback': 'answer_online_fallback',
             'auto_load': 'answer_auto_load', 'temporary_cleanup': 'answer_temporary_cleanup'}
    for name, value in options.items():
        core.set_setting(names[name], '1' if value else '0')
    core.audit('answer_flow.policy_changed', options)
    return policy()


def _record(task_id, stage, route='', note='', candidate_id=''):
    with core.conn() as db:
        db.execute('''INSERT INTO answer_flow(task_id,stage,route,note,candidate_id,updated)
            VALUES(?,?,?,?,?,?) ON CONFLICT(task_id) DO UPDATE SET
            stage=excluded.stage,route=excluded.route,note=excluded.note,
            candidate_id=excluded.candidate_id,updated=excluded.updated''',
            (task_id, stage, route, note[:500], candidate_id, core.utcnow()))


def history():
    return core.records('''SELECT f.*,r.source_url,r.lesson,r.evidence,r.status AS review_status
        FROM answer_flow f LEFT JOIN answer_reviews r ON r.task_id=f.task_id
        ORDER BY f.updated DESC,f.rowid DESC LIMIT 50''')


def submit_research(task_id, answer, source_url, *, confirmed=False):
    """Accept a manually obtained online answer; never imply browser automation."""
    init_schema()
    if (confirmed is not True or not isinstance(answer,str) or not 5 <= len(answer.strip()) <= 10000
            or not isinstance(source_url,str) or not source_url.startswith('https://')
            or len(source_url)>1000 or online_provider.has_probable_secret(answer+source_url)):
        raise core.EngineError('Provide a bounded answer and HTTPS source without credentials.')
    with core.conn() as db:
        row=db.execute('SELECT stage FROM answer_flow WHERE task_id=?',(task_id,)).fetchone()
        if not row or row['stage'] not in ('awaiting_input','awaiting_review'):
            raise core.EngineError('Only a waiting workflow can receive research.')
        changed=db.execute("UPDATE tasks SET status='awaiting_review',output=?,error='',updated=? WHERE id=? AND status IN ('awaiting_input','awaiting_review')",
                           (answer.strip(),core.utcnow(),task_id)).rowcount
        if not changed:raise core.EngineError('Task is no longer waiting.')
        db.execute("INSERT OR REPLACE INTO answer_reviews(task_id,answer,source_url) VALUES(?,?,?)",
                   (task_id,answer.strip(),source_url))
    _record(task_id,'awaiting_review','online-handoff',note='Online answer received; check the source before closing.')
    office_agents.send(task_id,'Research','Reviewer','manual research',answer.strip())
    office_agents.send(task_id,'Reviewer','Manager','review required','Manual research is unverified until the owner checks the cited source.')
    return {'status':'awaiting_review','browser_automated':False}


def close_review(task_id, evidence, lesson, *, confirmed=False):
    """Review, close and learn in one SQLite transaction; no model self-certification."""
    init_schema()
    if (confirmed is not True or not all(isinstance(x,str) and 10<=len(x.strip())<=2000 for x in (evidence,lesson))
            or online_provider.has_probable_secret(evidence+lesson)):
        raise core.EngineError('Provide verification evidence and a lesson of 10–2000 characters each.')
    with core.conn() as db:
        db.execute('BEGIN IMMEDIATE')
        task=db.execute("SELECT * FROM tasks WHERE id=? AND status='awaiting_review'",(task_id,)).fetchone()
        review=db.execute("SELECT * FROM answer_reviews WHERE task_id=? AND status='pending'",(task_id,)).fetchone()
        if not task or not review:raise core.EngineError('Only a pending review can be closed.')
        if online_provider.has_probable_secret(task['prompt']+review['answer']):
            raise core.EngineError('Possible private credentials; redact before learning.')
        # New answers enter the existing shared, bounded reviewed-memory store.
        ident=secrets.token_hex(12)
        learned=review['answer']+'\n\nLesson learned: '+lesson.strip()
        if len(learned)>10000:
            learned='Reviewed lesson: '+lesson.strip()+'\nFull answer is retained in task '+task_id+'.'
        question=task['prompt'] if len(task['prompt'])<=1000 else 'Lesson from task '+task_id
        db.execute('''INSERT INTO adaptive_solutions
            (id,question,answer,origin,source_url,status,evidence,created,updated)
            VALUES(?,?,?,?,?,'verified',?,?,?)''',
            (ident,question,learned,'owner',review['source_url'],
             evidence.strip(),core.utcnow(),core.utcnow()))
        db.execute("""UPDATE adaptive_solutions SET status='superseded' WHERE id IN
            (SELECT id FROM adaptive_solutions WHERE status='verified'
             ORDER BY updated DESC,rowid DESC LIMIT -1 OFFSET 500)""")
        output=review['answer']+'\n\nLesson learned: '+lesson.strip()
        db.execute("UPDATE tasks SET status='completed',output=?,error='',updated=? WHERE id=?",
                   (output,core.utcnow(),task_id))
        db.execute("UPDATE answer_reviews SET status='approved',evidence=?,lesson=? WHERE task_id=?",
                   (evidence.strip(),lesson.strip(),task_id))
        db.execute("UPDATE answer_flow SET stage='completed',candidate_id=?,note=?,updated=? WHERE task_id=?",
                   (ident,'Verified, closed, and saved to shared local memory.',core.utcnow(),task_id))
    office_agents.close(task_id,evidence.strip(),lesson.strip())
    core.audit('answer_flow.reviewed',{'task_id':task_id,'memory_id':ident,'weights_trained':False})
    if policy()['temporary_cleanup']:quarantine_temporary()
    return {'status':'completed','memory_id':ident,'lesson':lesson.strip(),'weights_trained':False}


def _still_running(task_id):
    rows = core.records('SELECT status FROM tasks WHERE id=?', (task_id,))
    return bool(rows and rows[0]['status'] == 'running')


def cancel(task_id, *, confirmed=False):
    if confirmed is not True or not re.fullmatch('[0-9a-f]{16}', str(task_id)):
        raise core.EngineError('Confirm cancellation of a valid answer task.')
    with core.conn() as db:
        task = db.execute('SELECT status FROM tasks WHERE id=?', (task_id,)).fetchone()
        recorded = db.execute('SELECT task_id FROM answer_flow WHERE task_id=?', (task_id,)).fetchone()
        if task and task['status'] == 'running' and not recorded:
            raise core.EngineError('This running task does not use the cancellable answer flow.')
        changed = db.execute("UPDATE tasks SET status='cancelled',updated=? WHERE id=? AND status IN ('queued','running','awaiting_input','awaiting_review')",
                             (core.utcnow(), task_id)).rowcount
    if not changed:
        raise core.EngineError('This task is already finished.')
    _record(task_id, 'cancelled', note='An in-flight model request may finish, but its result will not be accepted or learned.')
    return {'cancelled': True, 'external_request_undone': False}


def resume(task_id, *, confirmed=False):
    if confirmed is not True or not re.fullmatch('[0-9a-f]{16}', str(task_id)):
        raise core.EngineError('Confirm resubmission of a waiting task.')
    with core.conn() as db:
        changed = db.execute("UPDATE tasks SET status='queued',error='',updated=? WHERE id=? AND status='awaiting_input'",
                             (core.utcnow(), task_id)).rowcount
    if not changed:
        raise core.EngineError('Only a waiting task can be resumed here.')
    _record(task_id, 'queued')
    return {'queued': True}


def _normal(value):
    return ' '.join(value.casefold().split()).strip(' .?!')


def _notes(question):
    """Bounded local DB notes. Never sent to the online provider."""
    terms = set(re.findall(r'\w{3,}', question.casefold()))
    rows = []
    for note in core.memories():
        content = note.get('content', '')
        if not isinstance(content, str) or online_provider.has_probable_secret(content):
            continue
        words = set(re.findall(r'\w{3,}', (note.get('title', '') + ' ' + content).casefold()))
        score = len(words & terms)
        if score:
            rows.append((score, content[:700]))
    rows.sort(key=lambda item: item[0], reverse=True)
    local='\n'.join(text for _, text in rows[:2])
    reviewed=adaptive_runtime.recall(question[:1000])['matches'] if len(question.strip())>=3 else []
    shared=[m['answer'][:700] for m in reviewed[:2] if not online_provider.has_probable_secret(m['answer'])]
    # Small shared working memory of owner-checked lessons across all role types.
    lessons=core.records("SELECT lesson FROM answer_reviews WHERE status='approved' ORDER BY rowid DESC LIMIT 3")
    checked=[r['lesson'][:400] for r in lessons if not online_provider.has_probable_secret(r['lesson'])]
    return '\n'.join(filter(None,[local,*shared,*checked]))[:2400]


def _local_answer(job, options):
    backend, _ = core.active_backend()
    if not backend and options['auto_load']:
        choice = adaptive_runtime.automatic_choice()
        if choice.get('model'):
            # Rechecks GGUF metadata and currently available RAM before starting.
            core.start_local_model(choice['model'])
            for _ in range(20):
                if not _still_running(job['id']):
                    return None
                backend, _ = core.active_backend()
                if backend:
                    break
                time.sleep(1)
    if not backend:
        return None
    local_context = '\n'.join(filter(None, [job.get('context_snapshot', ''), _notes(job['prompt'])]))[:3200]
    prompt = ('Answer the current question using local context when relevant. '
              'If the provided information is insufficient, return exactly [NEEDS_ONLINE]. '
              'Never claim to execute tools or certify an answer.\n\nQuestion:\n' + job['prompt'])
    answer = core.infer(prompt, job['role'], max_tokens=420, context_snapshot=local_context)
    if not isinstance(answer, str) or len(answer.strip()) < 5 or answer.strip() == '[NEEDS_ONLINE]':
        return None
    return answer[:10000]


def process(job):
    init_schema()
    job=dict(job)
    job['role']=office_agents.route(job['role'],job['prompt'])
    with core.conn() as db:
        db.execute("UPDATE tasks SET role=? WHERE id=? AND status='running'",(job['role'],job['id']))
    options = policy()
    task_id = job['id']
    _record(task_id, 'local_lookup')
    office_agents.assign(job)
    if not _still_running(task_id):return
    # Similarity is an aid to search, never authority to substitute a different answer.
    matches = adaptive_runtime.recall(job['prompt'])['matches'] if len(job['prompt'])<=1000 else []
    # A prior answer is evidence for a draft, not proof it applies to today's task.
    exact = next((m for m in matches if _normal(m['question']) == _normal(job['prompt'])), None) if not job.get('context_snapshot') else None
    answer, route = (exact['answer'], 'reviewed-local-memory') if exact else (None, '')
    if answer is None:
        _record(task_id, 'local_model')
        try:
            answer = _local_answer(job, options)
        except core.EngineError:
            answer = None
        route = 'local-model' if answer else ''
    if not _still_running(task_id):
        return
    # Small models cannot reliably assess their own accuracy. Unreviewed output
    # must go through research/review even when the model sounds confident.
    sources=[]
    if route != 'reviewed-local-memory' and options['online_fallback']:
        _record(task_id, 'online_fallback', note='Only the current question is transmitted; local notes, files and saved history remain local.')
        office_agents.send(task_id,job['role'],'Research','online handoff',job['prompt'])
        try:
            result = online_provider.complete(job['prompt'], job['role'], approved=True)
            answer, route = result['answer'], 'online-provider'
            sources=result.get('sources',[])
        except online_provider.ProviderUnavailable as error:
            note = str(error)
            answer = None
        else:
            note = ''
    else:
        note = 'No sufficient local answer. Enable a configured online provider or install a compatible local model, then resume.'
    if not _still_running(task_id):
        return
    if not answer:
        with core.conn() as db:
            db.execute("UPDATE tasks SET status='awaiting_input',error=?,updated=? WHERE id=? AND status='running'",
                       (note[:500], core.utcnow(), task_id))
        _record(task_id, 'awaiting_input', note=note)
        return
    _record(task_id,'reviewing',route,'Reviewer is assessing the draft; no factual certification is implied.')
    office_agents.review(job,answer)
    if not _still_running(task_id):return
    # Deliver a draft, but never close or learn solely because generation succeeded.
    with core.conn() as db:
        changed = db.execute("UPDATE tasks SET status='awaiting_review',output=?,error='',updated=? WHERE id=? AND status='running'",
                             (answer[:10000], core.utcnow(), task_id)).rowcount
        if changed:
            source=sources[0]['url'] if route=='online-provider' and sources else (exact.get('source_url','') if exact else '')
            db.execute('INSERT OR REPLACE INTO answer_reviews(task_id,answer,source_url) VALUES(?,?,?)',
                       (task_id,answer[:10000],source))
    if not changed:
        return
    _record(task_id, 'awaiting_review', route, 'Check the answer against evidence, then close with a lesson learned.')
    if options['temporary_cleanup']:
        quarantine_temporary()
    core.audit('answer_flow.review_required', {'task_id': task_id, 'route': route,
                                       'weights_trained': False})


def quarantine_temporary(*, now=None):
    """Move only marked, old answer caches into a recoverable local recycle area."""
    now = time.time() if now is None else now
    original = core.DATA / 'temporary'
    if original.is_symlink():
        return {'moved': 0, 'deleted': 0}
    root = original.resolve()
    if not root.is_relative_to(core.DATA.resolve()) or not root.is_dir():
        return {'moved': 0, 'deleted': 0}
    moved = 0
    for entry in list(root.iterdir())[:100]:
        if (entry.is_symlink() or not entry.is_dir() or
                not re.fullmatch('answer-[0-9a-f]{16}', entry.name) or
                now - entry.stat().st_mtime < 86400):
            continue
        marker = entry / '.theorg-temporary.json'
        if marker.is_symlink() or not marker.is_file():
            continue
        try:
            if marker.stat().st_size > 2000 or json.loads(marker.read_text()).get('kind') != 'answer-cache':
                continue
            if any(p.is_symlink() for p in entry.rglob('*')):
                continue
            recycle = core.DATA / 'recycle'
            if recycle.is_symlink():
                continue
            recycle.mkdir(exist_ok=True)
            target = recycle / (entry.name + '-' + secrets.token_hex(4))
            if not target.resolve().is_relative_to(core.DATA.resolve()):
                continue
            shutil.move(str(entry), str(target))
            moved += 1
        except (OSError, ValueError):
            continue
    return {'moved': moved, 'deleted': 0, 'history_preserved': True}
