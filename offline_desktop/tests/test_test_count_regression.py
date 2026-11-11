"""Regression guard: AI must not delete tests and still obtain a verified commit."""
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from engine import core, coding, autopilot

class TestCountRegressionTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='theorg_regression_')
        self.addCleanup(self.tmp.cleanup)
        self.orig=core.DATA,core.WORKSPACE,core.MODELS,core.DB
        self.addCleanup(self.restore)
        root=Path(self.tmp.name)
        core.DATA=root/'data';core.WORKSPACE=root/'workspace';core.MODELS=root/'models'
        core.DB=core.DATA/'suite.sqlite3'
        core.init();coding.init_schema();autopilot.init_schema()
        self.project=coding.create_project('baseline_gate')
        self.repo=core.WORKSPACE/'projects'/'baseline_gate'
    def restore(self):
        core.DATA,core.WORKSPACE,core.MODELS,core.DB=self.orig
    def plan(self):
        p=coding.propose(self.project['id'],'Keep tests while adding version',
                         [{'path':'main.py','content':'def greet(name):\n    return f"Hello, {name}!"\n\nVERSION = "2"\n'}])
        coding.approve(p['id'],p['digest']);coding.apply(p['id'])
        return p
    def test_invalid_minimum_is_rejected(self):
        for n in (0,-1,True,1.0,'2',10001):
            with self.subTest(value=n),self.assertRaises(core.EngineError):
                coding.verify('nonexistent',minimum_test_count=n)
    def test_test_deletion_does_not_pass(self):
        p=self.plan()
        evidence={'passed':True,'available':True,'mode':'sandbox','exit_code':0,
                  'output':'Ran 1 test in 0.001s\nOK','test_count':1,
                  'network':'none','host_project_mount':False,
                  'image_id':'sha256:'+'a'*64}
        with patch.object(coding,'_run_tests_sandbox',return_value=evidence):
            result=coding.verify(p['id'],True,'sandbox',minimum_test_count=2)
        self.assertEqual(result['status'],'checks_failed')
        self.assertEqual(result['evidence']['checks']['unit_tests']['minimum_required'],2)
        coding.rollback(p['id'])
        self.assertEqual(coding._dirty(self.repo),'')
    def test_nonregression_can_verify(self):
        p=self.plan()
        evidence={'passed':True,'available':True,'mode':'sandbox','exit_code':0,
                  'output':'Ran 3 tests in 0.001s\nOK','test_count':3,
                  'network':'none','host_project_mount':False,
                  'image_id':'sha256:'+'a'*64}
        with patch.object(coding,'_run_tests_sandbox',return_value=evidence):
            result=coding.verify(p['id'],True,'sandbox',minimum_test_count=2)
        self.assertEqual(result['status'],'verified')

if __name__=='__main__':unittest.main()
