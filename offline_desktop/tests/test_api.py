"""Real local HTTP lifecycle; no cloud / no model weights required."""
import json, os, sys, tempfile, threading, unittest, urllib.error, urllib.request
from http.server import ThreadingHTTPServer
from pathlib import Path

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT))
import app
from engine import core, coding, chat_sessions, adaptive_runtime

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
        chat_sessions.init_schema()
        adaptive_runtime.init_schema()
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

    def test_integration_catalog_requires_auth_and_does_not_claim_connection(self):
        code,_,_=self.get('/api/integrations',auth=False)
        self.assertEqual(code,401)
        code,_,raw=self.get('/api/integrations')
        self.assertEqual(code,200)
        data=json.loads(raw)
        providers=data['integrations']
        self.assertEqual({item['provider'] for item in providers},
                         {'gmail','drive','calendar'})
        self.assertTrue(all(item['connected'] is None and item['status']=='not_verified'
                            for item in providers))
        self.assertNotIn('access_token',raw.decode('utf-8'))

    def test_models_api_exposes_honest_hardware_and_locked_benchmark(self):
        from unittest.mock import patch
        fake_hardware={'available_ram_bytes':8*1024**3,'total_ram_bytes':16*1024**3,
                       'platform':'Windows','cpu_cores':8}
        fake_gpu={'detected':False,'total_vram_bytes':None,'available_vram_bytes':None,
                  'source':'not_detected'}
        with patch.object(app.device_capabilities,'detect',return_value=fake_hardware),patch.object(
                app.device_capabilities,'detect_gpu_memory',return_value=fake_gpu),patch.object(
                app.core,'available_backends',return_value={'llamacpp':False,'ollama':[]}),patch.object(
                app.core,'active_backend',return_value=(None,None)):
            code,_,body=self.get('/api/models')
        self.assertEqual(code,200)
        result=json.loads(body)
        self.assertEqual(result['hardware']['available_ram_bytes'],8*1024**3)
        self.assertFalse(result['hardware']['gpu']['detected'])
        self.assertFalse(result['recommendation']['automatic_download_or_model_start'])
        self.assertFalse(result['inference_probe']['benchmark_unlocked'])

        core.invalidate_model_probe()
        with patch.object(app.core,'active_backend',return_value=('llamacpp','fake')),patch.object(
                app.core,'infer') as inference:
            code,body=self.post('/api/models/benchmark',{'confirmed':True})
            self.assertEqual(code,400)
            self.assertIn('Benchmark locked',body['error'])
            inference.assert_not_called()

    def test_full_chat_search_is_authenticated_read_only_and_exact_task_retrieval(self):
        self.assertEqual(self.get('/api/chat/search?q=release',auth=False)[0],401)
        code,created=self.post('/api/chat/sessions',{'title':'Review'})
        self.assertEqual(code,201)
        session=created['session']['id']
        task=self.post('/api/tasks',{'session_id':session,
                                    'prompt':'Review release approval gates',
                                    'role':'supervisor'})[1]['id']
        core.finish_task(task,output='No production deployment before approval.')
        query='/api/chat/search?q=release&session_id='+session
        code,_,raw=self.get(query)
        self.assertEqual(code,200)
        found=json.loads(raw)['search']
        self.assertFalse(found['remote_search_performed'])
        self.assertEqual(found['matches'][0]['id'],task)
        self.assertNotIn('context_snapshot',found['matches'][0])
        code,_,raw=self.get('/api/chat/task?id='+task)
        self.assertEqual(code,200)
        item=json.loads(raw)['task']
        self.assertEqual(item['output'],'No production deployment before approval.')
        self.assertNotIn('context_snapshot',item)
        self.assertEqual(self.get('/api/chat/search?q=x')[0],400)
        self.assertEqual(self.get('/api/chat/task?id=../bad')[0],400)

    def test_chat_context_requires_consent_and_does_not_reexpose_private_snapshot(self):
        code,created=self.post('/api/chat/sessions',{'title':'Local followups'})
        self.assertEqual(code,201)
        session=created['session']['id']
        first=self.post('/api/tasks',{'session_id':session,'prompt':'Explain regression gates','role':'supervisor'})[1]['id']
        core.finish_task(first,output='Only source checks can support source verification.')
        self.assertEqual(self.post('/api/chat/sessions/context',
            {'id':session,'enabled':True})[0],400)
        code,response=self.post('/api/chat/sessions/context',
            {'id':session,'enabled':True,'confirmed':True})
        self.assertEqual(code,200,response)
        self.assertTrue(response['session']['include_context'])
        second=self.post('/api/tasks',
            {'session_id':session,'prompt':'Continue regression plan','role':'supervisor'})[1]['id']
        row=core.records('SELECT context_snapshot FROM tasks WHERE id=?',(second,))[0]
        self.assertIn('Only source checks can support',row['context_snapshot'])
        code,_,body=self.get('/api/chat/session/tasks?id='+session)
        visible=json.loads(body)
        self.assertTrue(visible['tasks'][0]['has_context'])
        self.assertNotIn('context_snapshot',visible['tasks'][0])
        self.assertNotIn('context_snapshot',json.loads(self.get('/api/tasks')[2])['tasks'][0])
        self.assertEqual(self.post('/api/chat/sessions/context',
            {'id':session,'enabled':False,'confirmed':True})[0],200)
        third=self.post('/api/tasks',
            {'session_id':session,'prompt':'New independent request','role':'supervisor'})[1]['id']
        self.assertEqual(core.records(
            'SELECT context_snapshot FROM tasks WHERE id=?',(third,))[0]['context_snapshot'],'')
        self.assertEqual(self.post('/api/chat/sessions/context',
            {'id':'../bad','enabled':True,'confirmed':True})[0],400)

    def test_chat_sessions_persist_and_do_not_inject_model_context(self):
        self.assertEqual(self.get('/api/chat/sessions',auth=False)[0],401)
        status,created=self.post('/api/chat/sessions',{'title':'Design review'})
        self.assertEqual(status,201,created)
        ident=created['session']['id']
        status,task=self.post('/api/tasks',{'prompt':'Plan UI regression tests',
                                          'role':'supervisor','session_id':ident})
        self.assertEqual(status,201,task)
        self.assertEqual(task['session_id'],ident)
        code,_,data=self.get('/api/chat/session/tasks?id='+ident)
        self.assertEqual(code,200)
        messages=json.loads(data)['tasks']
        self.assertEqual(len(messages),1)
        self.assertEqual(messages[0]['prompt'],'Plan UI regression tests')
        self.assertEqual(messages[0]['status'],'queued')
        self.assertNotIn('conversation_context',messages[0])
        code,_,data=self.get('/api/chat/sessions')
        self.assertEqual(code,200)
        self.assertEqual(json.loads(data)['sessions'][0]['task_count'],1)
        self.assertEqual(self.post('/api/chat/sessions/rename',
                                  {'id':ident,'title':'Reviewed UI'})[0],200)
        self.assertEqual(self.post('/api/chat/sessions/archive',{'id':ident})[0],400)
        self.assertEqual(self.post('/api/chat/sessions/archive',
                                  {'id':ident,'confirmed':True})[0],200)
        self.assertEqual(self.post('/api/tasks',{'prompt':'Do not queue into archive',
                    'role':'supervisor','session_id':ident})[0],400)
        code,_,data=self.get('/api/chat/session/tasks?id='+ident)
        self.assertEqual(json.loads(data)['tasks'][0]['id'],task['id'])

    def test_adaptive_runtime_is_local_first_and_review_gated(self):
        self.assertEqual(self.get('/api/adaptive',auth=False)[0],401)
        code,_,body=self.get('/api/adaptive')
        self.assertEqual(code,200)
        info=json.loads(body)
        self.assertEqual([x['id'] for x in info['adaptive']['options']],
                         ['nano','lite','advanced'])
        self.assertIn('qwen35_2b',[m['id'] for m in info['models']])
        self.assertFalse(info['adaptive']['automatic_training'])
        self.assertEqual(self.post('/api/adaptive/select',{'tier':'nano'})[0],400)
        code,reply=self.post('/api/adaptive/select',{'tier':'nano','confirmed':True})
        self.assertEqual(code,200)
        self.assertEqual(reply['adaptive']['selected'],'nano')

        code,preview=self.post('/api/adaptive/resolve',{'query':'How to review CI failures?'})
        self.assertEqual(code,200)
        self.assertFalse(preview['resolution']['external_provider_contacted'])
        self.assertFalse(preview['resolution']['model_called'])

        data={'question':'How to review CI failures?',
              'answer':'Examine the job logs, check the commit SHA, then rerun source tests.',
              'origin':'owner','confirmed':True}
        self.assertEqual(self.post('/api/adaptive/solutions/propose',
                                   {**data,'confirmed':False})[0],400)
        code,response=self.post('/api/adaptive/solutions/propose',data)
        self.assertEqual(code,201,response)
        item=response['candidate']
        self.assertFalse(item['verified'])
        code,recall=self.post('/api/adaptive/recall',{'query':data['question']})
        self.assertEqual(code,200)
        self.assertEqual(recall['recall']['matches'],[])
        review={'id':item['id'],'approved':True,
                'evidence':'Confirmed from manually inspected passing CI logs.',
                'confirmed':True}
        code,result=self.post('/api/adaptive/solutions/review',review)
        self.assertEqual(code,200,result)
        code,found=self.post('/api/adaptive/resolve',{'query':data['question']})
        self.assertEqual(code,200)
        self.assertEqual(found['resolution']['route'],'reviewed-local-solution')
        self.assertFalse(found['resolution']['training_performed'])

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
