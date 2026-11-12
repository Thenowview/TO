"""No-live-network tests for separately authorized Google read-only probes."""
from __future__ import annotations

import json
import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import MagicMock, patch
import urllib.error

from engine import core, capabilities, google_readonly


class GoogleReadOnlyTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix="theorg_integrations_")
        self.addCleanup(self.tmp.cleanup)
        original = (core.DATA, core.WORKSPACE, core.MODELS, core.DB)
        self.addCleanup(lambda: self._restore(original))
        base = Path(self.tmp.name)
        core.DATA = base / "data"
        core.WORKSPACE = base / "workspace"
        core.MODELS = base / "models"
        core.DB = core.DATA / "app.sqlite3"
        core.init()
        capabilities.init_schema()

    @staticmethod
    def _restore(original):
        core.DATA, core.WORKSPACE, core.MODELS, core.DB = original

    def test_catalog_does_not_claim_connection(self):
        providers = google_readonly.catalog()
        self.assertEqual({p["provider"] for p in providers},
                         {"gmail", "drive", "calendar"})
        self.assertTrue(all(p["connected"] is None and p["status"] == "not_verified"
                            for p in providers))
        self.assertNotIn("token", str(providers).lower())

    def test_provider_allowlist_blocks_dynamic_urls_and_write_operations(self):
        for invalid in ("gmail/../../drive", "https://evil.example",
                        "gmail.send", None, "", "GMAIL"):
            with self.subTest(value=invalid), self.assertRaises(core.EngineError):
                google_readonly.normalize(invalid)
        with patch.dict(os.environ, {"THEORG_ENABLE_GOOGLE_READONLY": "1"}):
            for args in ({"provider": "gmail", "url": "https://evil.example"},
                         {"provider": "gmail", "operation": "send"},
                         {"provider": "invalid"}, {}):
                with self.subTest(args=args), self.assertRaises(core.EngineError):
                    capabilities.normalize("google.readonly.probe", args)

    def test_disabled_by_default(self):
        with patch.dict(os.environ, {"THEORG_ENABLE_GOOGLE_READONLY": "0"}):
            with self.assertRaisesRegex(core.EngineError, "disabled"):
                capabilities.prepare("google.readonly.probe", {"provider": "gmail"})

    def test_authorized_fixed_get_reports_no_record_content_or_token(self):
        for provider in ("gmail", "drive", "calendar"):
            with self.subTest(provider=provider):
                response = MagicMock()
                response.status = 200
                body = {
                    "gmail": {"labels": [{"id": "private"}]},
                    "drive": {"files": [{"id": "private"}]},
                    "calendar": {"items": [{"id": "private"}]}
                }[provider]
                response.read.return_value = json.dumps(body).encode("utf-8")
                response.__enter__.return_value = response
                response.__exit__.return_value = False
                opener = MagicMock()
                opener.open.return_value = response
                token = "A" * 32
                with patch.object(google_readonly, "_read_windows_credential",
                                  return_value=token), patch.object(
                        google_readonly.urllib.request, "build_opener",
                        return_value=opener) as factory:
                    result = google_readonly.probe(provider)
                self.assertTrue(result["connected"])
                self.assertTrue(result["read_probe_verified"])
                self.assertFalse(result["record_content_returned"])
                self.assertFalse(result["external_write_performed"])
                self.assertNotIn("private", json.dumps(result))
                self.assertNotIn(token, json.dumps(result))
                factory.assert_called_once()
                req = opener.open.call_args.args[0]
                self.assertEqual(req.get_method(), "GET")
                self.assertTrue(req.full_url.startswith("https://"))
                self.assertEqual(req.get_header("Authorization"), "Bearer " + token)
                self.assertEqual(opener.open.call_args.kwargs["timeout"], 12)

    def test_malformed_success_body_cannot_fabricate_authorized_read(self):
        response = MagicMock()
        response.status = 200
        response.read.return_value = b'{"message":"success"}'
        response.__enter__.return_value = response
        response.__exit__.return_value = False
        opener = MagicMock()
        opener.open.return_value = response
        with patch.object(google_readonly, "_read_windows_credential",
                          return_value="A" * 32), patch.object(
                google_readonly.urllib.request, "build_opener",
                return_value=opener):
            with self.assertRaisesRegex(core.EngineError, "resource shape"):
                google_readonly.probe("drive")

    def test_http_denial_is_explicit_not_fake_connected(self):
        response_error = urllib.error.HTTPError(
            "https://gmail.googleapis.com/", 403, "forbidden", None, None
        )
        opener = MagicMock()
        opener.open.side_effect = response_error
        with patch.object(google_readonly, "_read_windows_credential",
                          return_value="A" * 32), patch.object(
                google_readonly.urllib.request, "build_opener",
                return_value=opener):
            with self.assertRaisesRegex(core.EngineError, "HTTP 403"):
                google_readonly.probe("gmail")

    def test_token_missing_cannot_call_network(self):
        with patch.object(google_readonly, "_read_windows_credential",
                          side_effect=core.EngineError("not provisioned")), patch.object(
                google_readonly.urllib.request, "build_opener") as factory:
            with self.assertRaisesRegex(core.EngineError, "not provisioned"):
                google_readonly.probe("calendar")
            factory.assert_not_called()

    def test_api_requires_one_time_approval_without_side_effects(self):
        with patch.dict(os.environ, {"THEORG_ENABLE_GOOGLE_READONLY": "1"}):
            item = capabilities.prepare("google.readonly.probe", {"provider": "drive"})
            with self.assertRaisesRegex(core.EngineError, "approval"):
                capabilities.approve_and_execute(item["id"], item["digest"], False)
            with patch.object(google_readonly, "probe", return_value={
                "provider": "drive", "connected": True,
                "read_probe_verified": True, "external_write_performed": False
            }):
                result = capabilities.approve_and_execute(item["id"], item["digest"], True)
            self.assertEqual(result["status"], "completed")
            self.assertTrue(result["result"]["read_probe_verified"])
            with self.assertRaises(core.EngineError):
                capabilities.approve_and_execute(item["id"], item["digest"], True)


if __name__ == "__main__":
    unittest.main()
