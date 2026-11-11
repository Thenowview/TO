#!/usr/bin/env python3
"""Real offline Autopilot acceptance. No mock model, no external Git push.

Requires llama.cpp serving a real GGUF on 127.0.0.1:8081 and a cached,
verified Docker image. Synthetic project is deleted after each trial.
Never call this a pass unless real inference, code edit, isolated tests,
independent hidden tests, and a verified local Git commit all succeed.
"""
from __future__ import annotations
import argparse
import json
import shutil
import sys
import tempfile
import threading
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from engine import core, coding, autopilot

OBJECTIVE=(
    'Add clamp(value, lower, upper) in main.py. Return lower when value '
    'is below lower and upper when above upper; otherwise return value. '
    'Raise ValueError when lower > upper. Preserve greet(). '
    'Add meaningful unittest tests in tests/test_smoke.py.'
)
HIDDEN_TEST='''import unittest
from main import greet, clamp
class IndependentAcceptance(unittest.TestCase):
    def test_original(self):
        self.assertEqual(greet("TheOrg"), "Hello, TheOrg!")
    def test_lower(self):
        self.assertEqual(clamp(-5,0,10),0)
    def test_upper(self):
        self.assertEqual(clamp(20,0,10),10)
    def test_inside(self):
        self.assertEqual(clamp(3,0,10),3)
    def test_equal_bounds(self):
        self.assertEqual(clamp(20,3,3),3)
    def test_bad_bounds(self):
        with self.assertRaises(ValueError): clamp(1,7,2)
    def test_float(self):
        self.assertEqual(clamp(0.2,0.1,0.5),0.2)
'''

def examine(record, original, repo):
    """Check actual Git state and stored proof, not a model's self-assessment."""
    failures=[]
    if record['status']!='completed':
        failures.append('Autopilot did not complete')
    entries=[h for h in record['history'] if h.get('status')=='committed']
    if len(entries)!=1:
        failures.append('Exactly one Git commit was not evidenced')
        return failures
    entry=entries[0]
    head=coding._head(repo)
    if head==original or entry.get('commit_sha')!=head:
        failures.append('Git commit missing or does not match recorded SHA')
    if coding._dirty(repo):
        failures.append('Git tree is dirty')
    baseline=entry.get('baseline') or {}
    if type(baseline.get('test_count')) is not int or baseline['test_count']<1:
        failures.append('No non-empty pre-edit test baseline')
    plan=coding.get_plan(entry['plan_id'])
    evidence=plan.get('evidence') or {}
    if plan['status']!='committed' or plan['origin']!='local-model':
        failures.append('No committed local-model plan')
    if evidence.get('verified_digest')!=entry.get('digest'):
        failures.append('Plan approval digest mismatch')
    if evidence.get('git_parent')!=original:
        failures.append('Unexpected Git parent')
    if not coding.accepted_test_evidence(
            evidence.get('checks',{}).get('unit_tests'),require_sandbox=True):
        failures.append('Post-edit isolated unit-test evidence missing')
    return failures

def run(timeout=720):
    report={'benchmark':'TheOrg real local clamp challenge v1','status':'failed',
            'real_model_required':True,'model_calls_mocked':False,
            'sandbox_required':True,'external_git_push':False}
    saved=core.DATA,core.WORKSPACE,core.MODELS,core.DB
    with tempfile.TemporaryDirectory(prefix='theorg-real-acceptance-') as directory:
        root=Path(directory)
        try:
            core.DATA=root/'data';core.WORKSPACE=root/'workspace'
            core.MODELS=root/'models';core.DB=core.DATA/'acceptance.sqlite3'
            core.init();coding.init_schema();autopilot.init_schema()
            core.set_setting('backend','llamacpp')
            if not core.available_backends()['llamacpp']:
                raise core.EngineError('No llama.cpp endpoint at 127.0.0.1:8081; no real model tested')
            sandbox=coding.sandbox_status()
            if not sandbox.get('available'):
                raise core.EngineError('Offline Docker image unavailable: '+str(sandbox.get('reason')))
            probe=core.probe_local_model()  # live HTTP generation, not mocked
            report['probe_elapsed_seconds']=probe['elapsed_seconds']
            report['image_id']=sandbox['image_id']
            project=coding.create_project('real_clamp_challenge')
            repo=core.WORKSPACE/'projects'/'real_clamp_challenge'
            original=coding._head(repo)
            run=autopilot.authorize(project['id'],OBJECTIVE,autopilot.SCOPED_APPROVAL,
                                    max_attempts=2,start=False)
            worker=threading.Thread(target=autopilot._execute,
                args=(run['id'],project['id'],OBJECTIVE,2),daemon=True)
            worker.start();worker.join(timeout)
            if worker.is_alive():
                try: autopilot.request_cancel(run['id'])
                except core.EngineError: pass
                worker.join(15)
                raise core.EngineError('Autopilot exceeded deadline; cancellation requested')
            record=next(x for x in autopilot.list_runs(100) if x['id']==run['id'])
            report['autopilot_status']=record['status']
            report['attempts']=len(record['history'])
            failures=examine(record,original,repo)
            if failures:
                raise core.EngineError('; '.join(failures))
            independent=root/'independent-check'
            (independent/'tests').mkdir(parents=True)
            shutil.copy2(repo/'main.py',independent/'main.py')
            (independent/'tests'/'test_hidden.py').write_text(HIDDEN_TEST,encoding='utf-8')
            proof=coding._run_tests_sandbox(independent)
            report['hidden_test_count']=proof.get('test_count',0)
            if not coding.accepted_test_evidence(proof,require_sandbox=True):
                raise core.EngineError('Independent hidden tests did not pass inside Docker')
            report['verified_git_sha']=coding._head(repo)
            report['status']='passed'
        except Exception as exc:
            report['error']=str(exc)[:700]
        finally:
            core.DATA,core.WORKSPACE,core.MODELS,core.DB=saved
    return report

def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--timeout',type=int,default=720)
    parser.add_argument('--report',type=Path)
    args=parser.parse_args()
    if not 60<=args.timeout<=1800:
        parser.error('timeout must be between 60 and 1800 seconds')
    result=run(args.timeout)
    data=json.dumps(result,indent=2,sort_keys=True)+'\n'
    if args.report:
        args.report.parent.mkdir(parents=True,exist_ok=True)
        args.report.write_text(data,encoding='utf-8')
    print(data)
    return 0 if result['status']=='passed' else 2

if __name__=='__main__':
    raise SystemExit(main())
