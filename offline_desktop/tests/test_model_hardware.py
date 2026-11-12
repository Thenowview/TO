"""Synthetic hardware advice and benchmark UI safety tests; not GPU inference proof."""
import json
import unittest
from types import SimpleNamespace
from unittest.mock import patch

from engine import device_capabilities as devices


class HardwareAdviceTests(unittest.TestCase):
    def test_recommendations_follow_available_ram_not_total_ram(self):
        model_files=[
            {"name":"tiny.gguf","bytes":400*devices.MIB},
            {"name":"medium.gguf","bytes":4*devices.GIB},
            {"name":"large.gguf","bytes":13*devices.GIB}
        ]
        fake_gpu={"detected":False,"total_vram_bytes":None,
                  "available_vram_bytes":None}
        low=devices.recommend_local_model(model_files,
                        available_bytes=3*devices.GIB,gpu=fake_gpu)
        self.assertEqual(low["recommendation"],"Tiny on-device")
        self.assertEqual(low["recommended_installed_file"],"tiny.gguf")
        self.assertFalse(low["automatic_download_or_model_start"])
        self.assertFalse(low["benchmark_authorized"])
        high=devices.recommend_local_model(model_files,
                        available_bytes=20*devices.GIB,gpu=fake_gpu)
        self.assertEqual(high["recommendation"],"Expanded local")
        self.assertEqual(high["recommended_installed_file"],"large.gguf")
        self.assertFalse(high["inference_verified"])

    def test_unknown_or_low_ram_never_claims_a_suitable_model(self):
        with patch("engine.core.available_physical_memory_bytes",return_value=None):
            unknown=devices.recommend_local_model([{"name":"a.gguf","bytes":1}],
                                                   gpu={"detected":False})
        self.assertIsNone(unknown["recommended_installed_file"])
        self.assertEqual(unknown["recommendation"],"No safe local model size inferred")
        tiny=devices.recommend_local_model([{"name":"a.gguf","bytes":1}],
                         available_bytes=256*devices.MIB,gpu={"detected":False})
        self.assertEqual(tiny["estimated_max_gguf_file_bytes"],0)

    def test_gpu_unavailable_is_unknown_not_zero_memory(self):
        with patch.object(devices.sys,"platform","linux"):
            with patch("pathlib.Path.is_file",return_value=False):
                result=devices.detect_gpu_memory()
        self.assertFalse(result["detected"])
        self.assertIsNone(result["available_vram_bytes"])
        self.assertFalse(result["inference_gpu_acceleration_verified"])

    def test_nvidia_driver_reports_actual_free_memory_without_claiming_gpu_offload(self):
        with patch.object(devices.sys,"platform","linux"),patch("pathlib.Path.is_file",return_value=True),patch(
                "pathlib.Path.is_symlink",return_value=False),patch(
                "subprocess.run",return_value=SimpleNamespace(
                    returncode=0,
                    stdout="Test NVIDIA GPU, 8192, 6240\nSecond GPU, 4096, 1024\n"
                )) as cmd:
            value=devices.detect_gpu_memory()
        self.assertTrue(value["detected"])
        self.assertEqual(value["available_vram_bytes"],6240*devices.MIB)
        self.assertEqual(value["total_vram_bytes"],8192*devices.MIB)
        self.assertEqual(value["source"],"nvidia-smi-memory-query")
        self.assertFalse(value["inference_gpu_acceleration_verified"])
        self.assertEqual(cmd.call_args.kwargs["timeout"],5)

    def test_driver_errors_cannot_create_fake_vram(self):
        with patch.object(devices.sys,"platform","linux"),patch("pathlib.Path.is_file",return_value=True),patch(
                "pathlib.Path.is_symlink",return_value=False),patch(
                "subprocess.run",return_value=SimpleNamespace(
                    returncode=0,stdout="Fake GPU, 8192, Not Supported"
                )):
            result=devices.detect_gpu_memory()
        self.assertFalse(result["detected"])


if __name__=="__main__":
    unittest.main()
