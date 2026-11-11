"""Offline infrastructure tests; fake local inference is explicitly not a model benchmark."""
from __future__ import annotations
import http.server, json, os, sys, tempfile, threading, time, unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
from engine import core

class CoreTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix='theorg_test_')
        self.addCleanup(self.tmp.cleanup)
        base=Path(self.tmp.name)
        self.paths=(core.DATA,core.WORKSPACE,core.MODELS,core.DB)
        core.DATA=base/'data';core.WORKSPACE=base/'workspace';core.MODELS=base/'models';core.DB=core.DATA/'test.sqlite3'
        self.addCleanup(self.restore)
        self.token=core.init()

    def restore(self):
        core.DATA,core.WORKSPACE,core.MODELS,core.DB=self.paths

    def test_init_token_and_schema(self):
        self.assertGreaterEqual(len(self.token),30)
        self.assertEqual(self.token,core.init())
        self.assertEqual(core.tasks(),[])
        self.assertEqual(len(core.PROFILES),12)

    def test_queue_persistence_recovery_and_cancel(self):
        a=core.enqueue('Generate offline acceptance criteria','qa')
        job=core.pop_task()
        self.assertEqual(job['id'],a)
        self.assertEqual(core.records('SELECT status FROM tasks WHERE id=?',(a,))[0]['status'],'running')
        core.init()
        self.assertEqual(core.records('SELECT status FROM tasks WHERE id=?',(a,))[0]['status'],'queued')
        job=core.pop_task()
        core.finish_task(job['id'],output='Acceptance criteria completed')
        self.assertEqual(core.tasks()[0]['status'],'completed')
        b=core.enqueue('No model installed','supervisor')
        core.cancel_task(b)
        self.assertEqual(core.records('SELECT status FROM tasks WHERE id=?',(b,))[0]['status'],'cancelled')
        with self.assertRaises(core.EngineError):core.cancel_task(a)

    def test_memory_is_durable_and_bounded(self):
        i=core.add_memory('Preference','Run only on this machine')
        self.assertEqual(core.memories()[0]['id'],i)
        core.init()
        self.assertEqual(len(core.memories()),1)
        core.delete_memory(i)
        self.assertEqual(core.memories(),[])
        with self.assertRaises(core.EngineError):core.add_memory('','bad')

    def test_scoped_files_and_extensions(self):
        core.write_file('plans/demo.md','Test local plan')
        self.assertEqual(core.read_file('plans/demo.md'),'Test local plan')
        self.assertEqual(len(core.list_files()),1)
        for bad in ['../../outside.md','/etc/passwd','C:\\Windows\\secret.txt','\\server\\share.txt']:
            with self.subTest(path=bad), self.assertRaises(core.EngineError):core.write_file(bad,'no')
        with self.assertRaises(core.EngineError):core.write_file('shell.exe','no')
        outside=Path(self.tmp.name)/'outside';outside.mkdir()
        pointer=core.WORKSPACE/'escape'
        try:pointer.symlink_to(outside,target_is_directory=True)
        except (OSError,NotImplementedError):return
        with self.assertRaises(core.EngineError):core.write_file('escape/evil.md','no')

    def test_no_model_means_fail_not_fabricated(self):
        with patch.object(core,'available_backends',return_value={'llamacpp':False,'ollama':[]}):
            with self.assertRaisesRegex(core.EngineError,'No offline AI model'):
                core.infer('Describe the project','supervisor')
        with self.assertRaises(core.EngineError):core.local_http_json('https://example.com/api')

    def test_fake_local_inference_contract_and_worker(self):
        # Mock the LOCAL HTTP call; this does not prove real token generation.
        sent=[]
        def fake_http(url,obj=None,timeout=5,**kwargs):
            sent.append((url,obj))
            return {'choices':[{'message':{'content':'MOCK_ENGINE_OUTPUT'}}]}
        with patch.object(core,'available_backends',return_value={'llamacpp':True,'ollama':[]}),patch.object(core,'local_http_json',side_effect=fake_http):
            a=core.enqueue('Summarize a synthetic item','research')
            worker=core.QueueWorker();worker.start()
            deadline=time.monotonic()+4
            while time.monotonic()<deadline:
                current=core.records('SELECT * FROM tasks WHERE id=?',(a,))[0]
                if current['status']=='completed':break
                time.sleep(.05)
            worker.stop.set();worker.thread.join(2)
            self.assertEqual(current['output'],'MOCK_ENGINE_OUTPUT')
            self.assertEqual(current['status'],'completed')
            self.assertEqual(sent[0][0],'http://127.0.0.1:8081/v1/chat/completions')
            self.assertEqual(sent[0][1]['messages'][-1]['content'],'Summarize a synthetic item')
            self.assertEqual(len(sent[0][1]['messages']),2)

    def test_invalid_model_stub_rejected(self):
        (core.MODELS/'placeholder.gguf').write_bytes(b'GGUF')
        with self.assertRaisesRegex(core.EngineError,'valid-looking GGUF'):
            core.start_local_model('placeholder.gguf')

if __name__=='__main__':unittest.main(verbosity=2)
