"""Unattended coding must reject fabricated, incomplete, or ambiguous test claims."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from engine import core, coding, autopilot

class EvidenceContractTests(unittest.TestCase):
    def test_sandbox_requires_consistent_pinned_evidence(self):
        good={'passed':True,'available':True,'mode':'sandbox','network':'none',
              'exit_code':0,'test_count':2,'output':'Ran 2 tests in 0.12s\n\nOK',
              'host_project_mount':False,'image_id':'sha256:'+'a'*64}
        self.assertTrue(coding.accepted_test_evidence(good,require_sandbox=True))
        for key,value in (
            ('test_count',0),('test_count',True),('test_count',1),
            ('exit_code',None),('exit_code',1),('passed','true'),
            ('available',False),('network','bridge'),('network',None),
            ('image_id','sha256:mock'),('image_id',None),
            ('host_project_mount',True),('host_project_mount',None),
            ('mode','trusted_local'),('output','OK')):
            with self.subTest(field=key,value=value):
                self.assertFalse(coding.accepted_test_evidence(
                    {**good,key:value},require_sandbox=True))
        self.assertFalse(coding.accepted_test_evidence(None,require_sandbox=True))

    def test_trusted_tests_need_nonempty_result_and_never_qualify_as_sandbox(self):
        good={'passed':True,'available':True,'mode':'trusted_local',
              'test_count':1,'exit_code':0,'output':'Ran 1 test in 0.02s\nOK'}
        self.assertTrue(coding.accepted_test_evidence(good))
        self.assertFalse(coding.accepted_test_evidence(good,require_sandbox=True))
        self.assertFalse(coding.accepted_test_evidence({**good,'test_count':0}))

    def test_autopilot_does_not_edit_on_forged_baseline(self):
        with tempfile.TemporaryDirectory() as folder:
            original=(core.DATA,core.WORKSPACE,core.MODELS,core.DB)
            root=Path(folder)
            try:
                core.DATA=root/'data';core.WORKSPACE=root/'workspace'
                core.MODELS=root/'models';core.DB=core.DATA/'api.sqlite3'
                core.init();coding.init_schema();autopilot.init_schema()
                p=coding.create_project('proof_probe')
                repo=core.WORKSPACE/'projects'/'proof_probe'
                head=coding._head(repo)
                with patch.object(core,'active_backend',return_value=('llamacpp','local')), \
                     patch.object(coding,'sandbox_status',return_value={'available':True,'image':'local'}), \
                     patch.object(coding,'_run_tests_sandbox',return_value={
                         'passed':True,'available':True,'mode':'sandbox',
                         'exit_code':0,'test_count':0,'output':'OK',
                         'network':'none','host_project_mount':False,
                         'image_id':'sha256:'+'a'*64}), \
                     patch.object(core,'infer',side_effect=AssertionError('Inference must not run')):
                    run=autopilot.authorize(p['id'],'Improve code and tests',
                                            autopilot.SCOPED_APPROVAL,1,start=False)
                    autopilot._execute(run['id'],p['id'],'Improve code and tests',1)
                record=next(x for x in autopilot.list_runs() if x['id']==run['id'])
                self.assertEqual(record['status'],'failed')
                self.assertIn('before editing',record['error'])
                self.assertEqual(coding._head(repo),head)
                self.assertEqual(coding._dirty(repo),'')
            finally:
                core.DATA,core.WORKSPACE,core.MODELS,core.DB=original

if __name__=='__main__':
    unittest.main()
