"""v0.8 context retrieval and source-only preflight contract tests.

No test here pretends that a GGUF has been decoded by an actual LLM.
"""
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from engine import core, coding

class ContextTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='theorg_v08_')
        self.addCleanup(self.tmp.cleanup)
        self.old=(core.DATA,core.WORKSPACE,core.MODELS,core.DB)
        self.addCleanup(lambda:self._reset())
        base=Path(self.tmp.name)
        core.DATA=base/'data';core.WORKSPACE=base/'workspace';core.MODELS=base/'models';core.DB=base/'data'/'state.sqlite3'
        core.init();coding.init_schema()
        self.p=coding.create_project('context_project')
        self.root=core.WORKSPACE/'projects'/'context_project'
    def _reset(self):
        core.DATA,core.WORKSPACE,core.MODELS,core.DB=self.old

    def test_context_selects_relevant_paths_instead_of_first_nine(self):
        for i in range(15):
            (self.root/f'irrelevant_{i:02d}.py').write_text('CONSTANT = 1\n')
        (self.root/'parser.py').write_text('def parse_json_file(value):\n    return value\n')
        coding._git(self.root,'add','--','.')
        coding._git(self.root,'commit','-m','Synthetic test fixtures')
        result=coding.project_context(self.p['id'],'Improve the JSON parser and parse_json_file',limit=4)
        self.assertIn('parser.py',[f['path'] for f in result['files']])
        self.assertEqual(result['files'][0]['path'],'parser.py')
        self.assertTrue(result['git_head'])
        self.assertEqual(coding._dirty(self.root),'')
        self.assertGreater(result['files_scanned'],9)

    def test_context_covers_small_sources_and_hard_budget(self):
        context=coding.project_context(self.p['id'],'greet function tests',char_budget=1000)
        self.assertGreater(len(context['files']),0)
        self.assertTrue(any(f['path']=='main.py' for f in context['files']))
        self.assertLessEqual(context['context_chars'],1000)
        self.assertTrue(all(len(f['content'])>0 for f in context['files']))

    def test_context_rejects_bad_inputs_without_mutating_repo(self):
        for value in ['', 'x', 'x'*1201, None]:
            with self.subTest(value=str(value)[:9]),self.assertRaises(core.EngineError):
                coding.project_context(self.p['id'],value)
        with self.assertRaises(core.EngineError):
            coding.project_context(self.p['id'],'Find function',limit=1000)
        with self.assertRaises(core.EngineError):
            coding.project_context(self.p['id'],'Find function',char_budget=500000)
        self.assertFalse(coding._dirty(self.root))

    def test_generate_uses_context_and_capped_output(self):
        response='{"changes":[{"path":"main.py","content":"def greet(name):\\n    return name\\n"}]}'
        with patch.object(core,'infer',return_value=response) as call:
            result=coding.generate_with_local_model(self.p['id'],'Change greet function')
        self.assertEqual(result['status'],'draft')
        self.assertIn('Selected source snapshot',call.call_args.args[0])
        self.assertIn('main.py',call.call_args.args[0])
        self.assertEqual(call.call_args.kwargs['max_tokens'],1800)
        self.assertFalse(coding._dirty(self.root))

    def test_inference_budget_validation(self):
        for val in (0,3001,'750',True):
            with self.subTest(val=val),self.assertRaises(core.EngineError):
                core.infer('test','developer',max_tokens=val)

    def test_docker_missing_fails_closed(self):
        with patch('engine.coding.shutil.which',return_value=None):
            result=coding.sandbox_status()
        self.assertFalse(result['available'])
        self.assertIn('not installed',result['reason'])

    def test_sandbox_image_digest_required(self):
        class Completed:
            def __init__(self,s,rc=0):self.stdout=s;self.returncode=rc
        with patch('engine.coding.shutil.which',return_value='/usr/bin/docker'), \
             patch('engine.coding.subprocess.run',return_value=Completed('not-a-digest')):
            result=coding.sandbox_status()
        self.assertFalse(result['available'])
        with patch('engine.coding.shutil.which',return_value='/usr/bin/docker'), \
             patch('engine.coding.subprocess.run',return_value=Completed('sha256:'+'a'*64)):
            result=coding.sandbox_status()
        self.assertTrue(result['available'])
        self.assertEqual(result['image_id'],'sha256:'+'a'*64)

if __name__=='__main__':unittest.main()
