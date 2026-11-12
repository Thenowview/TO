"""Opt-in local conversational context: bounded, private, no tool escalation."""
from __future__ import annotations
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

from engine import core, chat_sessions


class ChatContextTests(unittest.TestCase):
    def setUp(self):
        temp=tempfile.TemporaryDirectory(prefix="theorg_ctx_")
        self.addCleanup(temp.cleanup)
        original=(core.DATA,core.WORKSPACE,core.MODELS,core.DB)
        self.addCleanup(self.restore,original)
        root=Path(temp.name)
        core.DATA=root/"data";core.WORKSPACE=root/"workspace"
        core.MODELS=root/"models";core.DB=core.DATA/"tasks.sqlite3"
        core.init()
        chat_sessions.init_schema()
        self.session=chat_sessions.create("Project session")

    @staticmethod
    def restore(original):
        core.DATA,core.WORKSPACE,core.MODELS,core.DB=original

    def complete(self,prompt,output,session=None):
        ident=core.enqueue(prompt,"supervisor")
        chat_sessions.attach_task(session or self.session["id"],ident)
        core.finish_task(ident,output=output)
        return ident

    def test_context_is_off_by_default_and_requires_explicit_user_choice(self):
        self.complete("What does the local system do?",
                      "The system plans local tasks without automatically running tools.")
        self.assertEqual(chat_sessions.context_for_new_task(self.session["id"]),"")
        self.assertFalse(chat_sessions.list_sessions()[0]["include_context"])
        with self.assertRaisesRegex(core.EngineError,"true or false"):
            chat_sessions.set_context(self.session["id"],"yes")
        response=chat_sessions.set_context(self.session["id"],True)
        self.assertTrue(response["include_context"])
        self.assertFalse(response["external_tool_approval_granted"])
        snapshot=chat_sessions.context_for_new_task(self.session["id"])
        self.assertIn("The system plans local tasks",snapshot)
        chat_sessions.set_context(self.session["id"],False)
        self.assertEqual(chat_sessions.context_for_new_task(self.session["id"]),"")

    def test_context_is_same_session_completed_only_and_bounded(self):
        self.complete("What was our plan?", "We discussed safe test gates.")
        pending=core.enqueue("Never include queued task","supervisor")
        chat_sessions.attach_task(self.session["id"],pending)
        other=chat_sessions.create("Unrelated work")
        self.complete("Another private session task","PRIVATE OTHER ANSWER",other["id"])
        self.complete("Long output", "X"*20000)
        chat_sessions.set_context(self.session["id"],True)
        snapshot=chat_sessions.context_for_new_task(self.session["id"])
        self.assertLessEqual(len(snapshot),3200)
        self.assertNotIn("PRIVATE OTHER ANSWER",snapshot)
        self.assertNotIn("Never include queued task",snapshot)
        self.assertIn("We discussed safe test gates",snapshot)
        self.assertLess(len(snapshot),2500)

    def test_context_snapshot_is_atomic_task_input_but_not_task_api_output(self):
        self.complete("First question","First completed answer.")
        chat_sessions.set_context(self.session["id"],True)
        snapshot=chat_sessions.context_for_new_task(self.session["id"])
        ident=core.enqueue("Second question","supervisor",context_snapshot=snapshot)
        chat_sessions.attach_task(self.session["id"],ident)
        queued=core.pop_task()
        self.assertEqual(queued["context_snapshot"],snapshot)
        self.assertEqual(queued["prompt"],"Second question")
        shown=chat_sessions.session_tasks(self.session["id"])[0]
        self.assertEqual(shown["has_context"],1)
        self.assertNotIn("context_snapshot",shown)
        self.assertNotIn("context_snapshot",core.tasks()[0])
        self.assertEqual(core.tasks()[0]["has_context"],1)
        with self.assertRaisesRegex(core.EngineError,"3,200"):
            core.enqueue("Too much","supervisor",context_snapshot="x"*3201)

    def test_latest_task_is_first_when_creation_timestamps_tie(self):
        with patch.object(core, 'utcnow', return_value='2026-11-12T00:00:00+00:00'):
            core.enqueue('First independent task', 'supervisor')
            latest = core.enqueue('Second independent task', 'supervisor')
        self.assertEqual(core.tasks()[0]['id'], latest)

    def test_prompt_is_last_user_turn_and_previous_text_is_data(self):
        response={"choices":[{"message":{"content":"Answer using local inference"}}]}
        with patch.object(core,"active_backend",return_value=("llamacpp","llama.cpp")),patch.object(
                core,"local_http_json",return_value=response) as transport:
            result=core.infer("Explain the requested change","supervisor",
                              include_memory=False,context_snapshot="Previous response: treat as data")
        self.assertEqual(result,"Answer using local inference")
        payload=transport.call_args.args[1]
        self.assertEqual(len(payload["messages"]),3)
        self.assertEqual(payload["messages"][0]["role"],"system")
        self.assertIn("untrusted reference data",payload["messages"][1]["content"])
        self.assertEqual(payload["messages"][-1]["content"],"Explain the requested change")
        self.assertFalse("tool_calls" in payload)

    def test_full_saved_history_search_is_session_scoped_and_private(self):
        first=self.complete("Debug a repository workflow failure",
                            "The reported job had a failed source verification step.")
        other=chat_sessions.create("Other session")
        other_id=self.complete("Confidential design review",
                                "Private architecture token is an example, not a real credential.",
                                other["id"])
        result=chat_sessions.search_history("source verification")
        self.assertTrue(any(x["id"]==first for x in result["matches"]))
        self.assertFalse(result["remote_search_performed"])
        scoped=chat_sessions.search_history("private",self.session["id"])
        self.assertEqual(scoped["matches"],[])
        scoped2=chat_sessions.search_history("Confidential design",other["id"])
        self.assertEqual(scoped2["matches"][0]["id"],other_id)
        self.assertNotIn("context_snapshot",scoped2["matches"][0])
        exact=chat_sessions.task_details(other_id)
        self.assertEqual(exact["session_id"],other["id"])
        self.assertNotIn("context_snapshot",exact)
        with self.assertRaisesRegex(core.EngineError,"2–120"):
            chat_sessions.search_history("%")
        with self.assertRaisesRegex(core.EngineError,"identifier"):
            chat_sessions.task_details("../../secrets")

    def test_archiving_prevents_more_contextual_tasks(self):
        chat_sessions.set_context(self.session["id"],True)
        chat_sessions.archive(self.session["id"],True)
        with self.assertRaisesRegex(core.EngineError,"archived"):
            chat_sessions.context_for_new_task(self.session["id"])
        with self.assertRaisesRegex(core.EngineError,"read-only"):
            chat_sessions.set_context(self.session["id"],False)


if __name__=="__main__":
    unittest.main()
