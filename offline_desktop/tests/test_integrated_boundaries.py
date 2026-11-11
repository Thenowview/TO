"""Approval gateway and advisory coordinator: offline, mocked model, real SQLite/Git."""
import os,tempfile,unittest
from pathlib import Path
from unittest.mock import patch
from engine import core,coding,coordination,capabilities

class IntegrationBoundaryTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='theorg_boundary_')
        self.addCleanup(self.tmp.cleanup)
        self.old=(core.DATA,core.WORKSPACE,core.MODELS,core.DB)
        self.addCleanup(self.restore)
        root=Path(self.tmp.name)
        core.DATA=root/'data';core.WORKSPACE=root/'workspace'
        core.MODELS=root/'models';core.DB=core.DATA/'test.sqlite3'
        core.init();coding.init_schema();coordination.init_schema();capabilities.init_schema()
        self.project=coding.create_project('scope_demo')
    def restore(self):
        core.DATA,core.WORKSPACE,core.MODELS,core.DB=self.old
    def test_advisory_roles_do_not_execute_tools(self):
        with patch.object(core,'infer',return_value='Advisory only') as model:
            a=coordination.create(self.project['id'],'Review source and tests',coordination.SCOPE,start=False)
            coordination._execute(a['id'])
        record=coordination.get(a['id'])
        self.assertEqual(record['status'],'completed')
        self.assertEqual([r['role'] for r in record['steps']],list(coordination.ROLES))
        self.assertEqual(model.call_count,len(coordination.ROLES))
        self.assertTrue(all(x.kwargs.get('include_memory') is False for x in model.call_args_list))
    def test_interrupted_requires_fresh_approval(self):
        a=coordination.create(self.project['id'],'Review source changes',coordination.SCOPE,start=False)
        with core.conn() as db:
            db.execute("UPDATE agent_reviews SET status='running' WHERE id=?",(a['id'],))
        coordination.init_schema()
        self.assertEqual(coordination.get(a['id'])['status'],'interrupted')
        with self.assertRaises(core.EngineError):coordination.resume(a['id'])
    def test_changed_head_invalidates_advisory(self):
        a=coordination.create(self.project['id'],'Review project context',coordination.SCOPE,start=False)
        with core.conn() as db:db.execute("UPDATE agent_reviews SET status='interrupted' WHERE id=?",(a['id'],))
        repo=coding._project(self.project['id'])
        coding._git(repo,'commit','--allow-empty','-m','External revision')
        with self.assertRaisesRegex(core.EngineError,'changed'):
            coordination.resume(a['id'],confirmed=True)
    def test_disabled_tools_and_consumed_approvals(self):
        self.assertFalse(any(x['enabled'] for x in capabilities.catalog()))
        with self.assertRaises(core.EngineError):capabilities.prepare('desktop.workspace.open',{})
        with patch.dict(os.environ,{'THEORG_ENABLE_OS_ACTIONS':'1'}):
            p=capabilities.prepare('desktop.workspace.open',{})
            with self.assertRaises(core.EngineError):
                capabilities.approve_and_execute(p['id'],p['digest'],confirmed=False)
            with patch.object(capabilities,'_execute',return_value={'opened':True}):
                r=capabilities.approve_and_execute(p['id'],p['digest'],confirmed=True)
            self.assertEqual(r['status'],'completed')
            with self.assertRaises(core.EngineError):
                capabilities.approve_and_execute(p['id'],p['digest'],confirmed=True)
    def test_browser_cannot_escape_workspace(self):
        with patch.dict(os.environ,{'THEORG_ENABLE_BROWSER_PREVIEW':'1'}):
            with self.assertRaises(core.EngineError):
                capabilities.prepare('browser.local.inspect',{'file':'../../etc/passwd.html','actions':[{'action':'text','selector':'h1'}]})

if __name__=='__main__':unittest.main()
