"""Synthetic persistence/authorization tests; no agent work executed."""
import tempfile,time,unittest
from pathlib import Path
from unittest.mock import patch
from engine import core,coding,orchestration

class OrchestrationTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory();self.addCleanup(self.temp.cleanup)
        base=Path(self.temp.name)
        self.paths=(core.DATA,core.WORKSPACE,core.MODELS,core.DB)
        core.DATA=base/'data';core.WORKSPACE=base/'workspace';core.MODELS=base/'models';core.DB=core.DATA/'db.sqlite3'
        self.addCleanup(self.restore)
        core.init();coding.init_schema();orchestration.init_schema()
        self.project=coding.create_project('workflow-test')
    def restore(self):core.DATA,core.WORKSPACE,core.MODELS,core.DB=self.paths
    def make(self):return orchestration.create(self.project['id'],'Fix a bounded local issue',[{'role':'planner','objective':'Plan exactly scoped change'},{'role':'qa','objective':'Inspect test evidence'}])
    def test_order_and_completion(self):
        w=self.make();a,b=(s['id'] for s in w['steps'])
        with self.assertRaises(core.EngineError):orchestration.authorize_step(b)
        orchestration.authorize_step(a)
        with self.assertRaises(core.EngineError):orchestration.authorize_step(a)
        with self.assertRaises(core.EngineError):orchestration.finish_step(a,'completed',{})
        x=orchestration.finish_step(a,'completed',{'summary':'Reviewed plan only','executed_tests':False})
        self.assertEqual(x['workflow_status'],'queued')
        orchestration.authorize_step(b)
        self.assertEqual(orchestration.finish_step(b,'completed',{'summary':'Read-only QA','executed_tests':False,'review_only':True})['workflow_status'],'completed')
    def test_restart_interrupts_without_reapproval(self):
        w=self.make();a=w['steps'][0]['id'];orchestration.authorize_step(a)
        orchestration.init_schema()
        self.assertEqual(orchestration.list_workflows()[0]['steps'][0]['status'],'interrupted')
        with self.assertRaises(core.EngineError):orchestration.finish_step(a,'completed',{'summary':'invalid'})
    def test_expiration_rejected(self):
        w=self.make();a=w['steps'][0]['id'];orchestration.authorize_step(a)
        with core.conn() as db:db.execute('UPDATE agent_workflow_steps SET authorization_deadline=? WHERE id=?',(time.time()-1,a))
        with self.assertRaisesRegex(core.EngineError,'expired'):
            orchestration.finish_step(a,'completed',{'summary':'LATE'})
        self.assertEqual(orchestration.list_workflows()[0]['steps'][0]['status'],'blocked')
    def test_false_test_evidence_and_cancel(self):
        w=self.make();a=w['steps'][0]['id'];orchestration.authorize_step(a)
        with self.assertRaisesRegex(core.EngineError,'require exact count'):
            orchestration.finish_step(a,'completed',{'summary':'Fake','executed_tests':True})
        orchestration.cancel(w['id'])
        self.assertEqual(orchestration.list_workflows()[0]['status'],'cancelled')
    def test_developer_completion_requires_committed_code_studio_plan(self):
        w=orchestration.create(self.project['id'],'Build a small change',[{'role':'developer','objective':'Edit approved local code'}])
        step=w['steps'][0]['id'];orchestration.authorize_step(step)
        with self.assertRaisesRegex(core.EngineError,'committed'):
            orchestration.finish_step(step,'completed',{'summary':'Model said success'})

    def test_cross_project_id_not_found(self):
        with self.assertRaises(core.EngineError):
            orchestration.create('a'*16,'Bad project',[{'role':'developer','objective':'Generate code changes'}])

if __name__=='__main__':unittest.main()
