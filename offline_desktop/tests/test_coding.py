"""Code Studio policy, Git and evidence tests using local temporary repositories."""
import json
import os
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from engine import core, coding

class CodeStudioTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='theorg_coding_')
        self.addCleanup(self.tmp.cleanup)
        self.orig=(core.DATA,core.WORKSPACE,core.MODELS,core.DB)
        self.addCleanup(self.restore)
        base=Path(self.tmp.name)
        core.DATA=base/'data';core.WORKSPACE=base/'workspace';core.MODELS=base/'models';core.DB=core.DATA/'database.sqlite3'
        self.saved_test_opt_in=os.environ.get('THEORG_ALLOW_TRUSTED_TESTS')
        os.environ['THEORG_ALLOW_TRUSTED_TESTS']='1'
        self.addCleanup(self.restore_trusted_opt_in)
        core.init();coding.init_schema()
        self.project=coding.create_project('sample_project')
        self.repo=core.WORKSPACE/'projects'/'sample_project'
    def restore_trusted_opt_in(self):
        if self.saved_test_opt_in is None:os.environ.pop('THEORG_ALLOW_TRUSTED_TESTS',None)
        else:os.environ['THEORG_ALLOW_TRUSTED_TESTS']=self.saved_test_opt_in
    def restore(self):
        core.DATA,core.WORKSPACE,core.MODELS,core.DB=self.orig

    def test_project_git_scaffold_is_clean(self):
        self.assertTrue(len(self.project['git_head'])>=40)
        self.assertFalse(self.project['dirty'])
        self.assertEqual(self.project['slug'],'sample_project')
        files=coding.project_files(self.project['id'])
        self.assertTrue(any(x['name']=='main.py' for x in files))
        self.assertIn('def greet',coding.read_project_file(self.project['id'],'main.py')['content'])
        self.assertFalse((self.repo/'.git'/'config').is_symlink())

    def change_plan(self,body=None):
        body=body or 'def greet(name):\n    return f"Hello, {name}!"\n\nVERSION = "0.2"\n'
        return coding.propose(self.project['id'],'Introduce source version metadata',[
            {'path':'main.py','content':body}])

    def test_review_approval_apply_verify_commit(self):
        p=self.change_plan()
        self.assertEqual(p['status'],'draft')
        self.assertIn('VERSION',p['changes'][0]['diff'])
        self.assertNotIn('VERSION',(self.repo/'main.py').read_text())
        with self.assertRaisesRegex(core.EngineError,'digest'):
            coding.approve(p['id'],'invalid-hash')
        with self.assertRaisesRegex(core.EngineError,'approval'):
            coding.apply(p['id'])
        coding.approve(p['id'],p['digest'])
        coding.apply(p['id'])
        self.assertIn('VERSION',(self.repo/'main.py').read_text())
        noexec=coding.verify(p['id'],run_tests=False)
        self.assertEqual(noexec['status'],'checks_failed')
        self.assertFalse(noexec['evidence']['unit_tests_requested'])
        verified=coding.verify(p['id'],run_tests=True,execution_mode='trusted_local')
        self.assertEqual(verified['status'],'verified',verified['evidence'])
        self.assertTrue(verified['evidence']['checks']['unit_tests']['passed'])
        done=coding.commit(p['id'],'Add synthetic source version')
        self.assertEqual(done['status'],'committed')
        self.assertTrue(len(done['evidence']['commit_sha'])>=40)
        self.assertEqual(coding._dirty(self.repo),'')
        self.assertEqual(coding._head(self.repo),done['evidence']['commit_sha'])

    def test_test_failure_and_rollback(self):
        faulty='def greet(name):\n    return "wrong answer"\n'
        original=(self.repo/'main.py').read_text()
        p=self.change_plan(faulty)
        coding.approve(p['id'],p['digest']);coding.apply(p['id'])
        result=coding.verify(p['id'],run_tests=True,execution_mode='trusted_local')
        self.assertEqual(result['status'],'checks_failed')
        self.assertFalse(result['evidence']['checks']['unit_tests']['passed'])
        with self.assertRaisesRegex(core.EngineError,'pass explicitly approved unit tests'):
            coding.commit(p['id'],'Do not commit')
        coding.rollback(p['id'])
        self.assertEqual((self.repo/'main.py').read_text(),original)
        self.assertEqual(coding._dirty(self.repo),'')

    def test_stale_changes_symlinks_and_restricted_paths(self):
        p=self.change_plan()
        (self.repo/'main.py').write_text('manual alteration\n')
        with self.assertRaisesRegex(core.EngineError,'not clean'):
            coding.approve(p['id'],p['digest'])
        with self.assertRaises(core.EngineError):
            coding.propose(self.project['id'],'escape',[{'path':'../../escape.py','content':'x'}])
        (self.repo/'main.py').write_text('def greet(name):\n    return f"Hello, {name}!"\n')
        for path in ['.git/config','.github/workflows/ci.yml','.env','scripts/../test.py','cmd.exe','foo/evil.sh']:
            with self.subTest(path=path), self.assertRaises(core.EngineError):
                coding.propose(self.project['id'],'bad path',[{'path':path,'content':'x'}])
        pointer=self.repo/'link.py'
        try:pointer.symlink_to(Path(self.tmp.name)/'outside.py')
        except (OSError,NotImplementedError):return
        with self.assertRaises(core.EngineError):
            coding.propose(self.project['id'],'symlink',[{'path':'link.py','content':'bad'}])

    def test_proposal_requires_clean_git_and_tampering_blocks_rollback(self):
        p=self.change_plan();coding.approve(p['id'],p['digest']);coding.apply(p['id'])
        (self.repo/'main.py').write_text('independent edit\n')
        with self.assertRaisesRegex(core.EngineError,'independently edited'):
            coding.rollback(p['id'])
        checked=coding.verify(p['id'],True,execution_mode='trusted_local')
        self.assertEqual(checked['status'],'checks_failed')
        self.assertFalse(checked['evidence']['checks']['integrity']['passed'])

    def test_local_model_only_drafts_never_applies(self):
        proposal={'changes':[{'path':'main.py','content':'def greet(name):\n    return name\n'}]}
        with patch.object(core,'infer',return_value=json.dumps(proposal)) as f:
            p=coding.generate_with_local_model(self.project['id'],'Change greeting')
            self.assertEqual(p['origin'],'local-model')
            self.assertEqual(p['status'],'draft')
            self.assertNotEqual((self.repo/'main.py').read_text(),proposal['changes'][0]['content'])
            self.assertEqual(f.call_args.args[1],'developer')
        with patch.object(core,'infer',return_value='not JSON'):
            with self.assertRaisesRegex(core.EngineError,'valid coding JSON'):
                coding.generate_with_local_model(self.project['id'],'Change greeting')

    def test_local_git_history_is_bounded_and_read_only(self):
        data=coding.project_history(self.project['id'])
        self.assertGreaterEqual(len(data['commits']),1)
        self.assertEqual(data['commits'][0]['sha'],self.project['git_head'])
        self.assertIn('Initial local project',data['commits'][0]['title'])
        with self.assertRaisesRegex(core.EngineError,'History limit'):
            coding.project_history(self.project['id'],limit=200)
        self.assertEqual(coding._dirty(self.repo),'')

    def test_search_is_bounded_case_insensitive_and_read_only(self):
        hits=coding.project_search(self.project['id'],'GREET')
        self.assertTrue(any(x['path']=='main.py' and x['line']==1 for x in hits['matches']))
        self.assertTrue(all(len(x['excerpt'])<=260 for x in hits['matches']))
        with self.assertRaisesRegex(core.EngineError,'Search phrase'):
            coding.project_search(self.project['id'],'')
        with self.assertRaisesRegex(core.EngineError,'limit'):
            coding.project_search(self.project['id'],'test',limit=10000)
        self.assertEqual(coding._dirty(self.repo),'')

    def test_repair_draft_from_failed_unit_test_preserves_original(self):
        faulty='def greet(name):\n    return "broken"\n'
        repaired='def greet(name):\n    return f"Hello, {name}!"\n\nFIXED = True\n'
        initial=(self.repo/'main.py').read_text()
        p=self.change_plan(faulty)
        coding.approve(p['id'],p['digest']);coding.apply(p['id'])
        failed=coding.verify(p['id'],run_tests=True,execution_mode='trusted_local')
        self.assertEqual(failed['status'],'checks_failed')
        with self.assertRaisesRegex(core.EngineError,'Roll back'):
            coding.generate_repair_with_local_model(p['id'])
        rolled=coding.rollback(p['id'])
        self.assertEqual(rolled['status'],'rolled_back')
        self.assertIn('unit_tests',rolled['evidence']['checks'])
        self.assertEqual((self.repo/'main.py').read_text(),initial)
        with patch.object(core,'infer',return_value=json.dumps({'changes':[{'path':'main.py','content':repaired}]})) as mock:
            proposal=coding.generate_repair_with_local_model(p['id'])
            self.assertIn('Failed reviewed edits',mock.call_args.args[0])
            self.assertIn('FAILED',mock.call_args.args[0])
        self.assertEqual(proposal['status'],'draft')
        self.assertEqual(proposal['origin'],'repair-model')
        self.assertNotEqual(proposal['digest'],p['digest'])
        self.assertEqual((self.repo/'main.py').read_text(),initial)
        coding.approve(proposal['id'],proposal['digest']);coding.apply(proposal['id'])
        verified=coding.verify(proposal['id'],run_tests=True,execution_mode='trusted_local')
        self.assertEqual(verified['status'],'verified',verified['evidence'])
        committed=coding.commit(proposal['id'],'Repair greeting from failed tests')
        self.assertEqual(committed['status'],'committed')
        self.assertEqual(committed['evidence']['verified_digest'],proposal['digest'])
        self.assertEqual(committed['evidence']['git_parent'],p['git_head'])
        self.assertEqual(committed['evidence']['committed_paths'],['main.py'])

    def test_repair_refuses_unverified_or_invalid_model_output(self):
        p=self.change_plan()
        coding.approve(p['id'],p['digest']);coding.apply(p['id'])
        # No unit tests: a rollback should not enable model repair.
        coding.verify(p['id'],run_tests=False)
        coding.rollback(p['id'])
        with self.assertRaisesRegex(core.EngineError,'no failed approved test'):
            coding.generate_repair_with_local_model(p['id'])
        bad=self.change_plan('def greet(name):\n    return "bad"\n')
        coding.approve(bad['id'],bad['digest']);coding.apply(bad['id'])
        coding.verify(bad['id'],run_tests=True);coding.rollback(bad['id'])
        with patch.object(core,'infer',return_value='not-json'):
            with self.assertRaisesRegex(core.EngineError,'valid JSON'):
                coding.generate_repair_with_local_model(bad['id'])
        self.assertEqual(coding._dirty(self.repo),'')

    def test_interrupted_state_fails_closed(self):
        p=self.change_plan()
        with core.conn() as db:db.execute("UPDATE code_plans SET status='applying' WHERE id=?",(p['id'],))
        coding.init_schema()
        self.assertEqual(coding.get_plan(p['id'])['status'],'interrupted')
        with self.assertRaisesRegex(core.EngineError,'draft'):
            coding.approve(p['id'],p['digest'])

    def test_git_hooks_disabled_even_for_commit(self):
        hooks=self.repo/'.git'/'hooks';hooks.mkdir(exist_ok=True)
        sentinel=self.repo/'hook_executed.txt'
        # If hooks were allowed the transaction would be blocked by exit 1.
        hook=hooks/'pre-commit';hook.write_text('#!/bin/sh\nexit 1\n');hook.chmod(0o755)
        p=self.change_plan();coding.approve(p['id'],p['digest']);coding.apply(p['id'])
        self.assertEqual(coding.verify(p['id'],True,execution_mode='trusted_local')['status'],'verified')
        self.assertEqual(coding.commit(p['id'],'Local commit without hooks')['status'],'committed')
        self.assertFalse(sentinel.exists())

if __name__=='__main__':unittest.main(verbosity=2)
