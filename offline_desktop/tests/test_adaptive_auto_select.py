"""Automatic Adaptive edition policy: no implicit model launch or data export."""
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from engine import core, adaptive_runtime

G = 1024**3

class AutomaticEditionTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory(prefix="adaptive_auto_")
        self.addCleanup(self.tmp.cleanup)
        base=Path(self.tmp.name)
        self.old=tuple(getattr(core,k) for k in ("DATA","WORKSPACE","MODELS","DB"))
        self.addCleanup(self.restore)
        core.DATA=base/"data";core.WORKSPACE=base/"workspace"
        core.MODELS=base/"models";core.DB=core.DATA/"data.sqlite3"
        core.init()
    def restore(self):
        core.DATA,core.WORKSPACE,core.MODELS,core.DB=self.old

    def test_auto_is_default_and_missing_runtime_uses_nano(self):
        self.assertEqual(adaptive_runtime.preference(),"auto")
        self.assertEqual(adaptive_runtime.recommend_for_device(8*G,3*G,[],False)["tier"],"nano")

    def test_invalid_header_does_not_promote(self):
        p=core.MODELS/"bad.gguf"
        p.write_bytes(b"NOPE"+b"x"*4092)
        self.assertEqual(adaptive_runtime.recommend_for_device(8*G,5*G,
            [{"name":p.name,"path":str(p),"bytes":p.stat().st_size}],True)["tier"],"nano")

    def test_8gb_with_2_2gb_free_cannot_load_08b_by_default(self):
        data=[{"name":"0.8B","path":"/missing","bytes":600_000_000}]
        self.assertEqual(adaptive_runtime.recommend_for_device(8*G,int(2.2*G),
            data,True,check_headers=False)["tier"],"nano")

    def test_8gb_can_select_lite_if_good_model_and_memory(self):
        p=core.MODELS/"test.gguf"
        p.write_bytes(b"GGUF"+b"x"*4092)
        r=adaptive_runtime.recommend_for_device(8*G,4*G,
            [{"name":p.name,"path":str(p),"bytes":p.stat().st_size}],True)
        self.assertEqual(r["tier"],"lite")
        self.assertFalse(r["model_started"])

    def test_advanced_requires_16gb_total(self):
        models=[{"name":"4b.gguf","path":"/missing","bytes":2_700_000_000}]
        self.assertEqual(adaptive_runtime.recommend_for_device(8*G,7*G,
            models,True,check_headers=False)["tier"],"nano")
        self.assertEqual(adaptive_runtime.recommend_for_device(32*G,20*G,
            models,True,check_headers=False)["tier"],"advanced")

    def test_auto_preference_persists_without_loading_model(self):
        with patch("engine.device_capabilities.detect",return_value={
            "total_ram_bytes":8*G,"available_ram_bytes":int(2.2*G)}),\
             patch.object(core,"start_local_model") as start:
            result=adaptive_runtime.select("auto")
        self.assertEqual(result["selected"],"nano")
        self.assertEqual(result["choice_mode"],"auto")
        start.assert_not_called()

if __name__ == "__main__":unittest.main()
