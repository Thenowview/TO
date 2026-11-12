"""Synthetic review-only dataset export tests; never train a model."""
from __future__ import annotations
import importlib.util
import json
import tempfile
import unittest
from pathlib import Path
from engine import adaptive_runtime, core

SCRIPT=Path(__file__).resolve().parents[2]/"tools"/"prepare-adaptive-training.py"
spec=importlib.util.spec_from_file_location("adaptive_training_export",SCRIPT)
training=importlib.util.module_from_spec(spec)
spec.loader.exec_module(training)


class TrainingDatasetTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix="adaptive_training_")
        self.addCleanup(self.tmp.cleanup)
        root=Path(self.tmp.name)
        original=core.DATA,core.WORKSPACE,core.MODELS,core.DB
        self.addCleanup(self._restore,original)
        core.DATA=root/"data";core.WORKSPACE=root/"workspace"
        core.MODELS=root/"models";core.DB=core.DATA/"app.sqlite3"
        core.init();adaptive_runtime.init_schema()
        self.output=root/"export"/"train.jsonl"

    @staticmethod
    def _restore(original):
        core.DATA,core.WORKSPACE,core.MODELS,core.DB=original

    def add_verified(self,index):
        value=adaptive_runtime.propose(
            "How do I review local source checks for scenario "+str(index)+"?",
            "Inspect source tests, compare the approved commit, then summarize evidence for "+str(index),
            origin="owner"
        )
        adaptive_runtime.review(value["id"],approved=True,
            evidence="Owner verified the exact source-test logs and matching SHA number "+str(index))
        return value

    def test_export_requires_owner_confirmation_and_three_verified_examples(self):
        with self.assertRaisesRegex(ValueError,"Explicit"):
            training.export(core.DB,self.output,False)
        with self.assertRaisesRegex(ValueError,"At least three"):
            training.export(core.DB,self.output,True)
        self.add_verified(1)
        unreviewed=adaptive_runtime.propose("Question for an external agent",
                                           "Unreviewed candidate must not be exported.",
                                           origin="external-agent")
        with self.assertRaisesRegex(ValueError,"At least three"):
            training.export(core.DB,self.output,True)
        self.add_verified(2);self.add_verified(3);self.add_verified(4);self.add_verified(5)
        report=training.export(core.DB,self.output,True)
        self.assertTrue(self.output.is_file())
        self.assertGreaterEqual(report["training_examples"],2)
        self.assertGreaterEqual(report["validation_examples"],1)
        self.assertFalse(report["adapter_trained"])
        combined=self.output.read_text()+Path(report["validation_path"]).read_text()
        self.assertNotIn("Unreviewed candidate",combined)
        self.assertEqual(training.validate(self.output)["valid"],True)
        self.assertEqual(training.validate(report["validation_path"])["valid"],True)
        with self.assertRaisesRegex(ValueError,"never overwrite"):
            training.export(core.DB,self.output,True)

    def test_reject_possible_secrets_and_malformed_dataset(self):
        for answer in ("api_key=SECRET01234567890123456789",
                       "-----BEGIN PRIVATE KEY-----\naaaaaaa"):
            with self.subTest(answer=answer),self.assertRaisesRegex(ValueError,"credentials"):
                training.safe_example("How to use token?",answer,
                                      "Owner verified confidential credential content.")
        malformed=Path(self.tmp.name)/"bad.jsonl"
        malformed.write_text('{"instruction":"x"}\n',encoding="utf-8")
        with self.assertRaisesRegex(ValueError,"schema"):
            training.validate(malformed)
        malformed.write_text("not-json",encoding="utf-8")
        with self.assertRaisesRegex(ValueError,"Invalid JSONL"):
            training.validate(malformed)

    def test_never_mutates_source_database_or_model_weights(self):
        self.add_verified(1);self.add_verified(2);self.add_verified(3)
        before=core.records("SELECT count(*) AS n FROM adaptive_solutions")[0]["n"]
        result=training.export(core.DB,self.output,True)
        after=core.records("SELECT count(*) AS n FROM adaptive_solutions")[0]["n"]
        self.assertEqual(before,after)
        self.assertFalse(result["model_weights_modified"])
        self.assertFalse(result["adapter_trained"])


if __name__=="__main__":
    unittest.main()
