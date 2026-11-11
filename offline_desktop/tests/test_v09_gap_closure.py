"""v0.9 regression and real local subprocess checks (no LLM weights required)."""
import json
import os
import tempfile
import threading
import unittest
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from unittest.mock import patch
from engine import core, coding

class GapClosureTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='theorg_v09_')
        self.addCleanup(self.tmp.cleanup)
        self.old=(core.DATA,core.WORKSPACE,core.MODELS,core.DB)
        self.addCleanup(self.restore)
        path=Path(self.tmp.name)
        core.DATA=path/'data';core.WORKSPACE=path/'workspace';core.MODELS=path/'models';core.DB=core.DATA/'db.sqlite3'
        core.init();coding.init_schema()
        self.proj=coding.create_project('audit_project')
        self.repo=core.WORKSPACE/'projects'/'audit_project'
    def restore(self):
        core.DATA,core.WORKSPACE,core.MODELS,core.DB=self.old

    def test_git_bundle_is_real_recoverable_repository(self):
        b=coding.export_git_bundle(self.proj['id'])
        bundle=Path(b['local_path'])
        self.assertTrue(bundle.is_file())
        self.assertGreater(bundle.stat().st_size,100)
        self.assertEqual(len(b['sha256']),64)
        self.assertTrue(b['offline'])
        self.assertEqual(b['git_head'],self.proj['git_head'])
        dest=Path(self.tmp.name)/'restored'
        # Restore into an independent directory using a real Git executable.
        import subprocess
        p=subprocess.run([core.git_binary(),'clone',str(bundle),str(dest)],capture_output=True,text=True,timeout=20)
        self.assertEqual(p.returncode,0,p.stderr)
        self.assertEqual((dest/'main.py').read_text(),(self.repo/'main.py').read_text())
        self.assertEqual(coding._dirty(self.repo),'')

    def test_git_bundle_refuses_dirty_project(self):
        (self.repo/'main.py').write_text('manual unapproved edit\n')
        with self.assertRaisesRegex(core.EngineError,'not clean'):
            coding.export_git_bundle(self.proj['id'])

    def test_local_probe_has_real_endpoint_requirement(self):
        with patch.object(core,'active_backend',return_value=(None,None)):
            with self.assertRaisesRegex(core.EngineError,'No running'):
                core.probe_local_model()

    def test_probe_only_reports_nonempty_generation(self):
        with patch.object(core,'active_backend',return_value=('llamacpp','local-GGUF')):
            with patch.object(core,'local_http_json',return_value={'choices':[{'message':{'content':'ready'}}]}) as request:
                r=core.probe_local_model()
                self.assertTrue(r['ok'])
                self.assertEqual(r['response_excerpt'],'ready')
                self.assertTrue(request.call_args.args[0].startswith('http://127.0.0.1:8081/'))
            with patch.object(core,'local_http_json',return_value={'choices':[{'message':{'content':'   '}}]}):
                with self.assertRaisesRegex(core.EngineError,'empty'):
                    core.probe_local_model()

    def test_inference_rejects_empty_or_malformed_model_responses(self):
        with patch.object(core,'active_backend',return_value=('llamacpp','local-GGUF')):
            with patch.object(core,'local_http_json',return_value={'choices':[{'message':{'content':''}}]}):
                with self.assertRaisesRegex(core.EngineError,'no usable text'):
                    core.infer('hi','developer')
            with patch.object(core,'local_http_json',return_value={'error':'unsupported template'}):
                with self.assertRaisesRegex(core.EngineError,'invalid completion'):
                    core.infer('hi','developer')

    def test_unittest_count_must_be_proven(self):
        self.assertEqual(coding._test_count('----------------------------------------------------------------------\nRan 0 tests in 0.000s\n\nOK'),0)
        self.assertEqual(coding._test_count('Ran 13 tests in 1.02s\n\nOK'),13)
        self.assertEqual(coding._test_count('Test server says OK but no proof'),0)

    def test_trusted_local_zero_tests_never_pass(self):
        from unittest.mock import patch
        root=Path(self.tmp.name)/'empty-tests'
        (root/'tests').mkdir(parents=True)
        (root/'tests'/'__init__.py').write_text('# test package\n')
        (root/'tests'/'test_nothing.py').write_text('# no test cases\n')
        with patch.dict(os.environ,{'THEORG_ALLOW_TRUSTED_TESTS':'1'}):
            r=coding._run_tests_trusted(root)
        self.assertEqual(r['exit_code'],5,r)  # unittest returns 5 when zero tests are discovered
        self.assertEqual(r['test_count'],0)
        self.assertFalse(r['passed'])
        self.assertIn('NO TESTS RAN',r['output'])

    def test_prefer_vetted_bundled_git_over_path_lookup(self):
        fake=core.BASE/'bin'/'git'/'cmd'/'git.exe'
        with patch('engine.core.Path.is_file',autospec=True,side_effect=lambda p: p==fake),\
             patch('engine.core.shutil.which',return_value='/malicious/path/git'):
            self.assertEqual(core.git_binary(),str(fake))

    def test_ui_has_wired_probe_and_git_export(self):
        html=(core.BASE/'static'/'index.html').read_text()
        script=(core.BASE/'static'/'app.js').read_text()
        self.assertIn('id="modelProbe"',html)
        self.assertIn('id="codeExportBundle"',html)
        self.assertIn("$('modelProbe').addEventListener('click',probeModelGeneration)",script)
        self.assertIn("$('codeExportBundle').addEventListener('click',exportLocalBundle)",script)

class RedirectSafetyTests(unittest.TestCase):
    def test_loopback_endpoint_never_follows_http_redirect(self):
        # This uses a real local HTTP listener and NEVER connects outside localhost.
        class RedirectHandler(BaseHTTPRequestHandler):
            def do_GET(self):
                self.send_response(302)
                self.send_header('Location','https://example.invalid/steal-private-prompt')
                self.end_headers()
            def log_message(self,*args):pass
        try:
            srv=ThreadingHTTPServer(('127.0.0.1',8081),RedirectHandler)
        except OSError:
            self.skipTest('Local inference port is already in use')
        t=threading.Thread(target=srv.serve_forever,daemon=True);t.start()
        try:
            with self.assertRaisesRegex(core.EngineError,'redirected'):
                core.local_http_json('http://127.0.0.1:8081/health',timeout=1)
        finally:
            srv.shutdown();srv.server_close();t.join(timeout=2)

if __name__=='__main__':unittest.main()
