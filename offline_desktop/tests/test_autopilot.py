"""Real Git state-machine tests with mocked isolated test execution and model.

A mocked sandbox result proves orchestration only; no model/sandbox is claimed
as actually deployed on the test runner.
"""
import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from engine import core, coding, autopilot

GOOD = 'def greet(name):\n    return f"Hello, {name}!"\n\nIMPROVED = True\n'
BAD = 'def greet(name):\n    return "broken"\n\nIMPROVED = True\n'

class AutopilotTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='theorg_autopilot_')
        self.addCleanup(self.tmp.cleanup)
        original=(core.DATA,core.WORKSPACE,core.MODELS,core.DB)
        self.addCleanup(lambda: self._restore(original))
        basedir=Path(self.tmp.name)
        core.DATA=basedir/'data'
        core.WORKSPACE=basedir/'workspace'
        core.MODELS=basedir/'models'
        core.DB=core.DATA/'test.sqlite3'
        core.init();coding.init_schema();autopilot.init_schema()
        self.project=coding.create_project('test_project')
        self.repo=core.WORKSPACE/'projects'/'test_project'
        self.baseline=coding._head(self.repo)
    @staticmethod
    def _restore(previous):
        core.DATA,core.WORKSPACE,core.MODELS,core.DB=previous
    def _authorize(self, *, start=False, attempts=2, scope=autopilot.SCOPED_APPROVAL):
        return autopilot.authorize(self.project['id'],'Improve greet and tests',scope,attempts,start=start)
    @staticmethod
    def ready():
        return {'available':True,'image':'theorg-test-local:verified','reason':'local test image found'}
    def _patch_ready(self):
        backend=patch.object(core,'active_backend',return_value=('llamacpp','local'))
        sandbox=patch.object(coding,'sandbox_status',side_effect=self.ready)
        backend.start();sandbox.start()
        self.addCleanup(backend.stop);self.addCleanup(sandbox.stop)

    def test_requires_exact_scoped_approval(self):
        with self.assertRaisesRegex(core.EngineError,'scope'):
            self._authorize(scope='anything')
    def test_rejects_missing_inference(self):
        with patch.object(core,'active_backend',return_value=(None,None)):
            with self.assertRaisesRegex(core.EngineError,'running LOCAL'):
                self._authorize()
    def test_rejects_missing_offline_sandbox(self):
        with patch.object(core,'active_backend',return_value=('llamacpp','local')),patch.object(coding,'sandbox_status',return_value={'available':False,'reason':'No local image'}):
            with self.assertRaisesRegex(core.EngineError,'sandbox'):
                self._authorize()
    def test_attempts_rejected_when_outside_limit(self):
        for val in (0,4,True,2.0,'2'):
            with self.subTest(val=val),self.assertRaises(core.EngineError):
                self._authorize(attempts=val)
    def test_per_project_concurrency_guard(self):
        self._patch_ready()
        created=self._authorize()
        with self.assertRaisesRegex(core.EngineError,'already active'):
            self._authorize()
        self.assertEqual(autopilot.list_runs()[0]['id'],created['id'])
    def test_restart_does_not_resume_approval(self):
        self._patch_ready()
        a=self._authorize()
        autopilot.init_schema()
        run=autopilot.list_runs()[0]
        self.assertEqual(run['id'],a['id'])
        self.assertEqual(run['status'],'interrupted')
        self.assertIn('fresh authorization',run['error'])
    def test_full_approved_commit_is_local_and_verified(self):
        self._patch_ready()
        data=json.dumps({'changes':[{'path':'main.py','content':GOOD}]})
        mocked_result={'passed':True,'available':True,'mode':'sandbox','exit_code':0,'output':'Ran 2 tests in 0.1s\nOK','network':'none','test_count':2,'host_project_mount':False,'image_id':'sha256:'+'a'*64}
        with patch.object(core,'infer',return_value=data) as model, patch.object(coding,'_run_tests_sandbox',return_value=mocked_result) as verify:
            run=self._authorize()
            autopilot._execute(run['id'],self.project['id'],'Improve greet and tests',2)
        record=autopilot.list_runs()[0]
        self.assertEqual(record['status'],'completed',record)
        self.assertEqual(record['history'][0]['status'],'committed')
        self.assertEqual(len(record['history']),1)
        self.assertNotEqual(coding._head(self.repo),self.baseline)
        self.assertEqual(coding._dirty(self.repo),'')
        self.assertEqual(model.call_count,1)
        self.assertEqual(verify.call_count,2)  # baseline + changed tree
        plan=coding.get_plan(record['history'][0]['plan_id'])
        self.assertEqual(plan['status'],'committed')
        self.assertEqual(plan['evidence']['execution_mode'],'sandbox')
    def test_rollback_then_repair_commit(self):
        self._patch_ready()
        original=(self.repo/'main.py').read_text()
        answers=[json.dumps({'changes':[{'path':'main.py','content':BAD}]}),json.dumps({'changes':[{'path':'main.py','content':GOOD}]})]
        def fake_sandbox(repo):
            source=(repo/'main.py').read_text()
            if 'broken' in source:
                return {'passed':False,'available':True,'mode':'sandbox','exit_code':1,'output':'FAILED test_greet: wrong result'}
            return {'passed':True,'available':True,'mode':'sandbox','exit_code':0,'output':'Ran 2 tests in 0.1s\nOK','network':'none','test_count':2,'host_project_mount':False,'image_id':'sha256:'+'a'*64}
        with patch.object(core,'infer',side_effect=answers) as model, patch.object(coding,'_run_tests_sandbox',side_effect=fake_sandbox):
            run=self._authorize(attempts=2)
            autopilot._execute(run['id'],self.project['id'],'Improve greet and tests',2)
        record=autopilot.list_runs()[0]
        self.assertEqual(record['status'],'completed',record)
        self.assertEqual([h['status'] for h in record['history']],['rolled_back','committed'])
        self.assertNotEqual((self.repo/'main.py').read_text(),original)
        self.assertEqual(model.call_count,2)
        self.assertNotEqual(coding._head(self.repo),self.baseline)
    def test_exhaustion_fails_without_commit_and_restores_source(self):
        self._patch_ready()
        original=(self.repo/'main.py').read_text()
        ans=json.dumps({'changes':[{'path':'main.py','content':BAD}]})
        fail={'passed':False,'available':True,'mode':'sandbox','exit_code':1,'output':'FAILED: bad greet'}
        baseline={'passed':True,'available':True,'mode':'sandbox','exit_code':0,'output':'Ran 2 tests in 0.1s\nOK','network':'none','test_count':2,'host_project_mount':False,'image_id':'sha256:'+'a'*64}
        with patch.object(core,'infer',return_value=ans),patch.object(coding,'_run_tests_sandbox',side_effect=[baseline,fail]):
            run=self._authorize(attempts=1)
            autopilot._execute(run['id'],self.project['id'],'Improve greet and tests',1)
        record=autopilot.list_runs()[0]
        self.assertEqual(record['status'],'failed',record)
        self.assertIn('no commit',record['error'])
        self.assertEqual((self.repo/'main.py').read_text(),original)
        self.assertEqual(coding._head(self.repo),self.baseline)
    def test_model_json_failure_does_not_modify_project(self):
        self._patch_ready()
        original=(self.repo/'main.py').read_text()
        with patch.object(core,'infer',return_value='NOT JSON'),patch.object(coding,'_run_tests_sandbox',return_value={'passed':True,'mode':'sandbox','exit_code':0,'network':'none','test_count':2,'host_project_mount':False,'image_id':'sha256:'+'a'*64,'available':True,'output':'Ran 2 tests in 0.1s\nOK'}):
            run=self._authorize(attempts=3)
            autopilot._execute(run['id'],self.project['id'],'Improve greet and tests',3)
        record=autopilot.list_runs()[0]
        self.assertEqual(record['status'],'failed')
        self.assertEqual((self.repo/'main.py').read_text(),original)
        self.assertEqual(coding._head(self.repo),self.baseline)

if __name__ == '__main__':unittest.main()

# Supplemental methods assigned to the class to keep test setup identical.
def _test_cancel_is_cooperative_and_no_commit(self):
    self._patch_ready()
    original=(self.repo/'main.py').read_text()
    run=self._authorize(start=False)
    autopilot.request_cancel(run['id'])
    with patch.object(core,'infer',side_effect=AssertionError('Model should not be called')):
        autopilot._execute(run['id'],self.project['id'],'Improve greet and tests',2)
    record=autopilot.list_runs()[0]
    self.assertEqual(record['status'],'cancelled')
    self.assertEqual((self.repo/'main.py').read_text(),original)
    self.assertEqual(coding._head(self.repo),self.baseline)

def _test_cancel_rejects_invalid_or_inactive_run(self):
    with self.assertRaises(core.EngineError):autopilot.request_cancel('../invalid')
    with self.assertRaises(core.EngineError):autopilot.request_cancel('0'*20)

AutopilotTests.test_cancel_is_cooperative_and_no_commit = _test_cancel_is_cooperative_and_no_commit
AutopilotTests.test_cancel_rejects_invalid_or_inactive_run = _test_cancel_rejects_invalid_or_inactive_run


def _test_global_concurrency_limit(self):
    self._patch_ready()
    self._authorize(start=False)
    other=coding.create_project('other_project')
    with self.assertRaisesRegex(core.EngineError,'already active'):
        autopilot.authorize(other['id'],'Improve source metadata',autopilot.SCOPED_APPROVAL,max_attempts=2,start=False)

AutopilotTests.test_global_concurrency_limit = _test_global_concurrency_limit


def _test_failed_baseline_refuses_to_edit_or_call_model(self):
    self._patch_ready()
    original=(self.repo/'main.py').read_text()
    with patch.object(core,'infer',side_effect=AssertionError('Model must not run after failed baseline')), \
         patch.object(coding,'_run_tests_sandbox',return_value={'passed':False,'mode':'sandbox','output':'Existing tests fail'}):
        run=self._authorize(start=False)
        autopilot._execute(run['id'],self.project['id'],'Improve greet and tests',2)
    record=autopilot.list_runs()[0]
    self.assertEqual(record['status'],'failed')
    self.assertIn('before editing',record['error'])
    self.assertEqual(original,(self.repo/'main.py').read_text())
    self.assertEqual(self.baseline,coding._head(self.repo))

AutopilotTests.test_failed_baseline_refuses_to_edit_or_call_model = _test_failed_baseline_refuses_to_edit_or_call_model
