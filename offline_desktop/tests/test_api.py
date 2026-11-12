"""Real local HTTP lifecycle; no cloud / no model weights required."""
import json, os, sys, tempfile, threading, unittest, urllib.error, urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import app
from engine import core, coding

class ApiTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory(prefix='theorg_api_')
        cls.save=(core.DATA,core.WORKSPACE,core.MODELS,core.DB)
        base=Path(cls.tmp.name)
        core.DATA=base/'data';core.WORKSPACE=base/'workspace';core.MODELS=base/'models';core.DB=core.DATA/'api.sqlite3'
        cls.saved_test_opt_in=os.environ.get('THEORG_ALLOW_TRUSTED_TESTS')
        os.environ['THEORG_ALLOW_TRUSTED_TESTS']='1'
        app.TOKEN=core.init()
        coding.init_schema()
        cls.server=ThreadingHTTPServer(('127.0.0.1',0),app.Handler)
        cls.server.daemon_threads=True
        cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True)
        cls.thread.start()
        cls.url='http://127.0.0.1:'+str(cls.server.server_address[1])
    @classmethod
    def tearDownClass(cls):
        cls.server.shutdown();cls.thread.join(timeout=2);cls.server.server_close()
        core.DATA,core.WORKSPACE,core.MODELS,core.DB=cls.save
        cls.tmp.cleanup()
        if cls.saved_test_opt_in is None:os.environ.pop('THEORG_ALLOW_TRUSTED_TESTS',None)
        else:os.environ['THEORG_ALLOW_TRUSTED_TESTS']=cls.saved_test_opt_in

    def get(self,path,auth=True):
        headers={'Authorization':'Bearer '+app.TOKEN} if auth else {}
        try:
            r=urllib.request.urlopen(urllib.request.Request(self.url+path,headers=headers),timeout=5)
            return r.status,r.headers, r.read()
        except urllib.error.HTTPError as e:
            return e.code,e.headers,e.read()
    def post(self,path,body,auth=True):
        headers={'Content-Type':'application/json'}
        if auth:headers['Authorization']='Bearer '+app.TOKEN
        b=json.dumps(body).encode()
        try:
            r=urllib.request.urlopen(urllib.request.Request(self.url+path,data=b,headers=headers,method='POST'),timeout=5)
            return r.status,json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code,json.loads(e.read())

    def test_browser_shell_available_and_locked_api(self):
        status,h,b=self.get('/')
        self.assertEqual(status,200);self.assertIn(b'THEORG',b)
        self.assertEqual(h.get('Content-Security-Policy').find("default-src 'self'"),0)
        self.assertEqual(self.get('/app.js')[0],200)
        self.assertEqual(self.get('/api/status',auth=False)[0],401)
        self.assertEqual(self.get('/../app.py')[0],404)
    def test_operator_preview_is_authenticated_and_never_executes_tools(self):
        from unittest.mock import patch
        code,body=self.post('/api/operator/plan',
            {'instruction':'Check GitHub runner and run tests'},auth=False)
        self.assertEqual(code,401)
        with patch.object(app.operator_tools,'_gh') as gh, patch.object(
                app.operator_tools,'_powershell') as powershell:
            code,body=self.post('/api/operator/plan',
                {'instruction':'Check GitHub runner and run tests'})
        self.assertEqual(code,200,body)
        self.assertTrue(body['plan']['draft_only'])
        self.assertFalse(body['plan']['actions_executed'])
        self.assertFalse(body['plan']['external_actions_authorized'])
        gh.assert_not_called()
        powershell.assert_not_called()
        self.assertEqual(self.post('/api/operator/plan',
            {'instruction':'x'})[0],400)

    def test_authenticated_status(self):
        status,h,b=self.get('/api/status')
        self.assertEqual(status,200);d=json.loads(b)
        self.assertTrue(d['ok']);self.assertTrue(d['offline'])
        self.assertIsNone(d['active_backend']);self.assertEqual(d['model_files'],0)
    def test_write_read_and_memory_api(self):
        code,body=self.post('/api/files/write',{'name':'notes/example.md','content':'Private example'})
        self.assertEqual(code,400)
        code,body=self.post('/api/files/write',{'name':'notes/example.md','content':'Private example','confirmed':True})
        self.assertEqual(code,200)
        code,body=self.post('/api/files/read',{'name':'notes/example.md'})
        self.assertEqual(body['content'],'Private example')
        code,body=self.post('/api/memories',{'title':'Note','content':'Source is synthetic'})
        self.assertEqual(code,201)
        self.assertGreaterEqual(len(json.loads(self.get('/api/memories')[2])['memories']),1)
        self.assertEqual(self.post('/api/memories/delete',{'id':body['id']})[0],200)
    def test_code_studio_http_approval_and_verification(self):
        self.assertEqual(self.get('/api/code/projects',auth=False)[0],401)
        self.assertEqual(self.post('/api/code/projects',{'slug':'web_demo'})[0],400)
        status,result=self.post('/api/code/projects',{'slug':'web_demo','confirmed':True})
        self.assertEqual(status,201,result)
        project=result['project']['id']
        code,doc=self.post('/api/code/files/read',{'project_id':project,'path':'main.py'})
        self.assertEqual(code,200,doc)
        changed=doc['content']+'\nMETA = "offline-only"\n'
        code,result=self.post('/api/code/plans',{'project_id':project,'objective':'Add metadata',
            'changes':[{'path':'main.py','content':changed}]})
        self.assertEqual(code,201,result)
        plan=result['plan']
        ident=plan['id']
        self.assertEqual(self.post('/api/code/plans/approve',{'id':ident,'digest':plan['digest']})[0],400)
        self.assertEqual(self.post('/api/code/plans/approve',{'id':ident,'digest':plan['digest'],'confirmed':True})[0],200)
        self.assertEqual(self.post('/api/code/plans/apply',{'id':ident,'confirmed':True})[0],200)
        self.assertEqual(self.post('/api/code/plans/verify',{'id':ident,'run_tests':True})[0],400)
        code,body=self.post('/api/code/plans/verify',{'id':ident,'run_tests':True,'execution_mode':'trusted_local','confirmed':True})
        self.assertEqual(code,200,body)
        self.assertEqual(body['plan']['status'],'verified',body)
        code,body=self.post('/api/code/plans/commit',{'id':ident,'message':'Add metadata','confirmed':True})
        self.assertEqual(code,200,body)
        self.assertEqual(body['plan']['status'],'committed')
        self.assertEqual(self.get('/api/code/files?project_id='+project)[0],200)

    def test_search_endpoint_and_repair_approval_boundary(self):
        status,response=self.post('/api/code/projects',{'slug':'search_demo','confirmed':True})
        self.assertEqual(status,201)
        project=response['project']['id']
        code,h,b=self.get('/api/code/search?project_id='+project+'&q=greet')
        self.assertEqual(code,200)
        self.assertGreaterEqual(len(json.loads(b)['matches']),1)
        self.assertGreaterEqual(len(json.loads(self.get('/api/code/history?project_id='+project)[2])['commits']),1)
        self.assertEqual(self.get('/api/code/search?project_id='+project+'&q=greet',auth=False)[0],401)
        self.assertEqual(self.post('/api/code/plans/repair',{'id':'0123456789abcdef0123'})[0],400)

    def test_task_api_queue_cancel(self):
        code,body=self.post('/api/tasks',{'prompt':'Write a test plan','role':'qa'})
        self.assertEqual(code,201)
        ident=body['id']
        self.assertEqual(self.post('/api/tasks/cancel',{'id':ident})[0],200)
        self.assertEqual(self.post('/api/tasks',{'prompt':'x','role':'missing'})[0],400)
        self.assertEqual(self.post('/api/files/read',{'name':'../../../etc/passwd'})[0],400)

if __name__=='__main__':unittest.main(verbosity=2)
