import json
from pathlib import Path
import tempfile
import threading
import time
import unittest
from engine import core,browser_bridge,online_provider

class BrowserBridgeTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.old=tuple(getattr(core,k) for k in ('DATA','WORKSPACE','MODELS','DB'));self.addCleanup(self.restore)
        r=Path(self.tmp.name);core.DATA=r/'data';core.WORKSPACE=r/'workspace';core.MODELS=r/'models';core.DB=core.DATA/'test.db'
        core.init();browser_bridge.init_schema();self.client='a'*32
    def restore(self):core.DATA,core.WORKSPACE,core.MODELS,core.DB=self.old
    def queued(self):
        browser_bridge.pair(self.client,confirmed=True)
        core.enqueue('Summarize these public task facts.','operations');job=core.pop_task()
        ident=browser_bridge.enqueue(job['id'],job['prompt'],job['role'])
        return job,ident
    def test_no_browser_research_without_pairing(self):
        with self.assertRaises(online_provider.ProviderUnavailable):browser_bridge.enqueue('a'*16,'Public question','research')
        with self.assertRaises(core.EngineError):browser_bridge.pair(self.client)
    def test_only_paired_client_can_claim(self):
        job,ident=self.queued()
        with self.assertRaises(core.EngineError):browser_bridge.claim('b'*32)
        request=browser_bridge.claim(self.client)['request'];self.assertEqual(request['id'],ident)
        self.assertEqual(request['question'],job['prompt']);self.assertIsNone(browser_bridge.claim(self.client)['request'])
    def test_completion_requires_single_use_lease(self):
        job,ident=self.queued();r=browser_bridge.claim(self.client)['request']
        with self.assertRaises(core.EngineError):browser_bridge.finish(self.client,ident,'wrong',answer='A research answer.',sources=[{'url':'https://chatgpt.com/c/example'}])
        result=browser_bridge.finish(self.client,ident,r['lease'],answer='A research answer.',sources=[{'url':'https://chatgpt.com/c/example'}])
        self.assertTrue(result['accepted']);self.assertFalse(result['independently_verified'])
        with self.assertRaises(core.EngineError):browser_bridge.finish(self.client,ident,r['lease'],answer='A replacement answer.',sources=[{'url':'https://chatgpt.com/'}])
    def test_cancelled_task_cannot_accept_browser_answer(self):
        job,ident=self.queued();r=browser_bridge.claim(self.client)['request']
        with core.conn() as db:db.execute("UPDATE tasks SET status='cancelled' WHERE id=?",(job['id'],))
        with self.assertRaises(core.EngineError):browser_bridge.finish(self.client,ident,r['lease'],answer='Late answer.',sources=[{'url':'https://chatgpt.com/'}])
    def test_credential_questions_are_blocked(self):
        browser_bridge.pair(self.client,confirmed=True)
        with self.assertRaises(online_provider.ProviderUnavailable):browser_bridge.enqueue('a'*16,'password=private-value','research')
    def test_invalid_sources_are_not_accepted(self):
        job,ident=self.queued();r=browser_bridge.claim(self.client)['request']
        for url in ['http://example.com/','https://user:password@example.com/','https://']:
            with self.assertRaises(core.EngineError):browser_bridge.finish(self.client,ident,r['lease'],answer='Research answer.',sources=[{'url':url}])
    def test_expired_request_is_not_claimed_or_resent(self):
        job,ident=self.queued()
        with core.conn() as db:db.execute('UPDATE browser_research SET deadline=0 WHERE id=?',(ident,))
        self.assertIsNone(browser_bridge.claim(self.client)['request'])
        self.assertEqual(core.records('SELECT status FROM browser_research WHERE id=?',(ident,))[0]['status'],'expired')
    def test_async_browser_result_reaches_waiting_task(self):
        browser_bridge.pair(self.client,confirmed=True);core.enqueue('Public research question.','research');job=core.pop_task();result={}
        def work():result.update(browser_bridge.complete(job['prompt'],job['role'],job['id'],approved=True))
        t=threading.Thread(target=work,daemon=True);t.start();request=None
        for _ in range(100):
            request=browser_bridge.claim(self.client)['request']
            if request:break
            time.sleep(.01)
        self.assertIsNotNone(request)
        browser_bridge.finish(self.client,request['id'],request['lease'],answer='Real bridge transport fixture.',sources=[{'url':'https://chatgpt.com/c/example'}])
        t.join(3);self.assertFalse(t.is_alive());self.assertEqual(result['answer'],'Real bridge transport fixture.')
    def test_prepare_preserves_modified_extension_files(self):
        info=browser_bridge.prepare_extension(confirmed=True);path=Path(info['folder'])/'popup.js';path.write_text('owner modification')
        with self.assertRaises(core.EngineError):browser_bridge.prepare_extension(confirmed=True)
        self.assertEqual(path.read_text(),'owner modification')
    def test_extension_does_not_request_cookie_history_or_all_site_access(self):
        root=Path(__file__).resolve().parents[2]/'chrome_company_bridge'
        manifest=json.loads((root/'manifest.json').read_text())
        self.assertFalse(set(manifest['permissions'])&{'cookies','history','debugger','nativeMessaging'})
        self.assertNotIn('<all_urls>',manifest['host_permissions'])

if __name__=='__main__':unittest.main()
