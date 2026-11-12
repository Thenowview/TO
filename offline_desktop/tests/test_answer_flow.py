"""Workflow acceptance tests use isolated databases and mocked providers only."""
import json
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from engine import core,answer_flow,adaptive_runtime,online_provider,office_agents,runtime_budget

class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.old=tuple(getattr(core,k) for k in ('DATA','WORKSPACE','MODELS','DB'))
        self.addCleanup(self.restore)
        root=Path(self.tmp.name);core.DATA=root/'data';core.WORKSPACE=root/'workspace';core.MODELS=root/'models';core.DB=core.DATA/'test.db'
        core.init();answer_flow.init_schema()
        answer_flow.configure({'enabled':True,'auto_load':False},confirmed=True)
        self.backend=patch.object(core,'active_backend',return_value=(None,None));self.backend.start();self.addCleanup(self.backend.stop)
    def restore(self):core.DATA,core.WORKSPACE,core.MODELS,core.DB=self.old
    def job(self,prompt='What is the approved deployment process?'):
        ident=core.enqueue(prompt,'operations');return core.pop_task()
    def row(self,ident):return core.records('SELECT * FROM tasks WHERE id=?',(ident,))[0]
    def draft(self):
        job=self.job()
        with patch.object(answer_flow,'_local_answer',return_value='Check the test evidence before deployment.'):
            answer_flow.process(job)
        return job
    def test_generated_answer_is_not_completed_or_learned(self):
        j=self.draft();self.assertEqual(self.row(j['id'])['status'],'awaiting_review')
        self.assertEqual(adaptive_runtime.recall(j['prompt'])['matches'],[])
        self.assertEqual([m['sender'] for m in office_agents.messages(j['id'])],['Manager','operations','Reviewer'])
    def test_close_requires_evidence_and_lesson(self):
        j=self.draft()
        for evidence,lesson in [('short','A sufficiently long lesson.'),('Checked source evidence.','no')]:
            with self.assertRaises(core.EngineError):answer_flow.close_review(j['id'],evidence,lesson,confirmed=True)
        self.assertEqual(self.row(j['id'])['status'],'awaiting_review')
    def test_review_closes_and_shared_memory_contains_lesson(self):
        j=self.draft();result=answer_flow.close_review(j['id'],'Compared against approved test results.','Installed tools do not prove tests passed.',confirmed=True)
        self.assertEqual(result['status'],'completed');self.assertFalse(result['weights_trained'])
        memory=adaptive_runtime.recall(j['prompt'])['matches'][0]
        self.assertIn('Installed tools do not prove',memory['answer'])
        self.assertIn('Installed tools do not prove',answer_flow._notes('A different company task'))
        self.assertEqual(office_agents.messages(j['id'])[-1]['kind'],'verified closure')
        with self.assertRaises(core.EngineError):answer_flow.close_review(j['id'],'Verified evidence again.','A duplicate lesson entry.',confirmed=True)
    def test_cancelled_result_cannot_learn(self):
        j=self.draft();answer_flow.cancel(j['id'],confirmed=True)
        with self.assertRaises(core.EngineError):answer_flow.close_review(j['id'],'Verified real evidence.','Keep cancelled results untrusted.',confirmed=True)
        self.assertEqual(self.row(j['id'])['status'],'cancelled')
    def test_provider_unavailable_waits_without_false_completion(self):
        j=self.job();answer_flow.configure({'online_fallback':True},confirmed=True)
        with patch.object(online_provider,'complete',side_effect=online_provider.ProviderUnavailable('Provider unavailable')):
            answer_flow.process(j)
        self.assertEqual(self.row(j['id'])['status'],'awaiting_input')
        self.assertIn('Provider unavailable',self.row(j['id'])['error'])
    def test_unreliable_local_draft_escalates_even_when_confident(self):
        j=self.job();answer_flow.configure({'online_fallback':True},confirmed=True)
        with patch.object(answer_flow,'_local_answer',return_value='Confident but unsupported answer'),patch.object(online_provider,'complete',return_value={'answer':'Sourced research answer.','sources':[{'url':'https://example.com/facts'}]}) as provider:
            answer_flow.process(j)
        provider.assert_called_once_with(j['prompt'],j['role'],approved=True)
        self.assertEqual(self.row(j['id'])['status'],'awaiting_review')
        self.assertEqual(answer_flow.history()[0]['route'],'online-provider')
    def test_manual_online_handoff_and_no_chat_reading_claim(self):
        j=self.job();answer_flow.process(j)
        r=answer_flow.submit_research(j['id'],'A checked research answer.','https://example.com/source',confirmed=True)
        self.assertFalse(r['browser_automated']);self.assertEqual(self.row(j['id'])['status'],'awaiting_review')
    def test_research_cannot_replace_completed_task(self):
        j=self.draft();answer_flow.close_review(j['id'],'Checked actual source evidence.','Keep completed tasks immutable.',confirmed=True)
        with self.assertRaises(core.EngineError):answer_flow.submit_research(j['id'],'Replacement answer.','https://example.com/',confirmed=True)
    def test_task_messages_do_not_cross_task_boundaries(self):
        a=self.draft();b=self.draft()
        office_agents.send(a['id'],'Manager','Reviewer','private note','Only task A should see this')
        self.assertFalse(any('Only task A' in m['body'] for m in office_agents.messages(b['id'])))
    def test_manager_routes_general_tasks_without_granting_permissions(self):
        self.assertEqual(office_agents.route('supervisor','Draft a customer reply'),'writer')
        self.assertEqual(office_agents.route('supervisor','Summarize meeting notes'),'operations')
        self.assertEqual(office_agents.route('security','Draft a customer reply'),'security')
        self.assertFalse(answer_flow.policy()['automatic_browser_chat_reading'])
    def test_private_credentials_are_not_learned(self):
        j=self.draft()
        with core.conn() as db:db.execute('UPDATE answer_reviews SET answer=? WHERE task_id=?',('password=private-value',j['id']))
        with self.assertRaises(core.EngineError):answer_flow.close_review(j['id'],'Checked actual evidence.','Do not save credentials to memory.',confirmed=True)
        self.assertEqual(self.row(j['id'])['status'],'awaiting_review')
    def test_resume_only_waiting_task(self):
        j=self.job();answer_flow.process(j);answer_flow.resume(j['id'],confirmed=True)
        self.assertEqual(self.row(j['id'])['status'],'queued')
        with self.assertRaises(core.EngineError):answer_flow.resume(j['id'],confirmed=True)
    def test_cleanup_preserves_unmarked_files_and_recovers_cache(self):
        root=core.DATA/'temporary';root.mkdir();keep=root/'notes.txt';keep.write_text('keep')
        cache=root/('answer-'+'a'*16);cache.mkdir();(cache/'.theorg-temporary.json').write_text('{"kind":"answer-cache"}')
        os.utime(cache,(1,1));result=answer_flow.quarantine_temporary(now=100000)
        self.assertEqual(result['moved'],1);self.assertTrue(keep.exists());self.assertEqual(result['deleted'],0)
        self.assertTrue(list((core.DATA/'recycle').iterdir()))

class RuntimeTests(unittest.TestCase):
    def test_unknown_or_insufficient_memory_blocks_model(self):
        self.assertFalse(runtime_budget.select(None,563036064,8)['load'])
        self.assertFalse(runtime_budget.select(1024**3,563036064,8)['load'])
    def test_runtime_scales_context_not_weights(self):
        low=runtime_budget.select(2300*1024**2,563036064,8);high=runtime_budget.select(8*1024**3,563036064,8)
        self.assertTrue(low['load']);self.assertLess(low['context'],high['context']);self.assertLessEqual(high['threads'],4)
    def test_secret_question_never_contacts_provider(self):
        with patch.object(online_provider.urllib.request,'build_opener') as network:
            with self.assertRaises(online_provider.ProviderUnavailable):online_provider.complete('password=private-value','research',approved=True)
        network.assert_not_called()

class ProviderTests(unittest.TestCase):
    def response(self,payload):
        class Response:
            def __enter__(self):return self
            def __exit__(self,*args):pass
            def read(self,n):return json.dumps(payload).encode()
        return Response()
    def run_provider(self,payload):
        env={'THEORG_ONLINE_PROVIDER':'openai','THEORG_ONLINE_MODEL':'owner-configured-model','OPENAI_API_KEY':'test-only-not-a-real-key'}
        with patch.dict(os.environ,env),patch.object(online_provider.urllib.request,'build_opener') as build:
            build.return_value.open.return_value=self.response(payload)
            result=online_provider.complete('A public research question','research',approved=True)
            request=build.return_value.open.call_args.args[0]
        return result,json.loads(request.data)
    def test_cited_research_uses_search_without_private_context(self):
        result,body=self.run_provider({'status':'completed','output':[{'type':'message','content':[{'type':'output_text','text':'A source-backed answer.','annotations':[{'type':'url_citation','url':'https://example.com/source','title':'Source'}]}]}]})
        self.assertEqual(body['input'],'A public research question');self.assertFalse(body['store'])
        self.assertEqual(body['tools'],[{'type':'web_search'}]);self.assertNotIn('files',body)
        self.assertEqual(result['sources'][0]['url'],'https://example.com/source');self.assertFalse(result['independently_verified'])
    def test_uncited_or_incomplete_answer_is_not_accepted(self):
        for payload in [{'status':'completed','output':[{'type':'message','content':[{'type':'output_text','text':'Unsupported claim.'}]}]}, {'status':'incomplete','output':[]}]:
            with self.assertRaises(online_provider.ProviderUnavailable):self.run_provider(payload)
    def test_unconfigured_provider_never_attempts_network(self):
        with patch.dict(os.environ,{'THEORG_ONLINE_PROVIDER':''}),patch.object(online_provider.urllib.request,'build_opener') as network:
            with self.assertRaises(online_provider.ProviderUnavailable):online_provider.complete('Public question','research',approved=True)
        network.assert_not_called()

if __name__=='__main__':unittest.main()
