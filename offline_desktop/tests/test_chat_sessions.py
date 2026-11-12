"""Local chat-session organization tests: independent tasks, no model context."""
from __future__ import annotations
import tempfile
import unittest
from pathlib import Path
from engine import core, chat_sessions


class SessionTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory(prefix="theorg_chat_sessions_")
        self.addCleanup(self.temp.cleanup)
        saved=(core.DATA,core.WORKSPACE,core.MODELS,core.DB)
        self.addCleanup(lambda:setattr(core,"DATA",saved[0]))
        self.addCleanup(lambda:setattr(core,"WORKSPACE",saved[1]))
        self.addCleanup(lambda:setattr(core,"MODELS",saved[2]))
        self.addCleanup(lambda:setattr(core,"DB",saved[3]))
        root=Path(self.temp.name)
        core.DATA=root/"data"; core.WORKSPACE=root/"workspace"
        core.MODELS=root/"models"; core.DB=core.DATA/"test.sqlite3"
        core.init(); chat_sessions.init_schema()

    def test_create_rename_archive_restore_and_searchable_titles(self):
        a=chat_sessions.create("  Design \n  review ")
        self.assertEqual(a["title"],"Design review")
        self.assertEqual(a["task_count"],0)
        self.assertEqual(chat_sessions.list_sessions()[0]["id"],a["id"])
        renamed=chat_sessions.rename(a["id"],"Chat UI")
        self.assertEqual(renamed["title"],"Chat UI")
        self.assertTrue(chat_sessions.archive(a["id"])["archived"])
        self.assertEqual(chat_sessions.list_sessions(),[])
        self.assertEqual(len(chat_sessions.list_sessions(include_archived=True)),1)
        with self.assertRaisesRegex(core.EngineError,"read-only"):
            chat_sessions.rename(a["id"],"No")
        self.assertFalse(chat_sessions.archive(a["id"],False)["archived"])
        self.assertEqual(chat_sessions.list_sessions()[0]["title"],"Chat UI")

    def test_tasks_grouped_without_changing_prompt_or_role(self):
        first=chat_sessions.create("First")
        second=chat_sessions.create("Second")
        task=core.enqueue("Explain the difference", "supervisor")
        before=core.records("SELECT prompt,role FROM tasks WHERE id=?",(task,))[0]
        chat_sessions.attach_task(first["id"],task)
        chat_sessions.attach_task(first["id"],task)  # safe idempotence
        self.assertEqual(chat_sessions.list_sessions()[0]["task_count"],1)
        self.assertEqual([x["id"] for x in chat_sessions.session_tasks(first["id"])],[task])
        self.assertEqual(chat_sessions.session_tasks(second["id"]),[])
        with self.assertRaisesRegex(core.EngineError,"another session"):
            chat_sessions.attach_task(second["id"],task)
        after=core.records("SELECT prompt,role FROM tasks WHERE id=?",(task,))[0]
        self.assertEqual(before,after)
        self.assertEqual(chat_sessions.assigned_task_ids()[0]["session_id"],first["id"])

    def test_reject_bad_ids_titles_and_missing_tasks(self):
        for item in ("../secrets","",None,"g"*24):
            with self.subTest(item=item),self.assertRaises(core.EngineError):
                chat_sessions.session_tasks(item)
        for title in ("", " "*4, "x"*101,None):
            with self.subTest(title=title),self.assertRaises(core.EngineError):
                chat_sessions.create(title)
        s=chat_sessions.create()
        with self.assertRaisesRegex(core.EngineError,"task ID"):
            chat_sessions.attach_task(s["id"],"abc")
        with self.assertRaisesRegex(core.EngineError,"not found"):
            chat_sessions.attach_task(s["id"],"a"*16)
        with self.assertRaisesRegex(core.EngineError,"not found"):
            chat_sessions.archive("a"*24)

    def test_archive_does_not_cancel_active_tasks(self):
        s=chat_sessions.create("Operator review")
        task=core.enqueue("Summarize changes","supervisor")
        chat_sessions.attach_task(s["id"],task)
        chat_sessions.archive(s["id"])
        self.assertEqual(chat_sessions.session_tasks(s["id"])[0]["status"],"queued")
        self.assertEqual(core.records("SELECT status FROM tasks WHERE id=?",(task,))[0]["status"],"queued")
        with self.assertRaisesRegex(core.EngineError,"read-only"):
            chat_sessions.attach_task(s["id"],core.enqueue("new","supervisor"))


if __name__ == "__main__":
    unittest.main()
