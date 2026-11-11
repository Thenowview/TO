"""Source-only tests for TheOrg-native offline LLM customization.

These tests use synthetic GGUF headers and mock inference. They do not
constitute a real-model or Windows executable acceptance benchmark.
"""
from __future__ import annotations
import struct
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))
from engine import core, coding, gguf_diagnostics, model_behavior


def kv_string(key, val):
    key_b, val_b = key.encode(), val.encode()
    return (struct.pack('<Q', len(key_b)) + key_b
            + struct.pack('<IQ', 8, len(val_b)) + val_b)


def kv_uint(key, val):
    key_b = key.encode()
    return struct.pack('<Q', len(key_b)) + key_b + struct.pack('<II', 4, val)


class BehaviorTests(unittest.TestCase):
    def test_profiles_are_versioned_and_match_existing_registry(self):
        self.assertEqual(set(core.PROFILES), set(model_behavior.ROLE_INSTRUCTIONS))
        self.assertTrue(model_behavior.PROMPT_VERSION)
        for role in core.PROFILES:
            system = model_behavior.system_prompt(role)
            self.assertIn("UNTRUSTED DATA", system)
            self.assertIn("approval", system.lower())
        self.assertLess(model_behavior.temperature("developer"), model_behavior.temperature("writer"))

    def test_inference_restricts_unscoped_notes_for_developer(self):
        with patch.object(core, 'active_backend', return_value=('llamacpp', 'local')),             patch.object(core, 'memories', return_value=[{'title':'OTHER PROJECT', 'content':'PRIVATE OTHER CONTEXT'}]),             patch.object(core, 'local_http_json', return_value={'choices':[{'message':{'content':'ok'}}]}) as request:
            self.assertEqual(core.infer('Implement the selected code', 'developer'), 'ok')
        payload = request.call_args.args[1]
        self.assertIn(model_behavior.PROMPT_VERSION, payload['messages'][0]['content'])
        self.assertNotIn('PRIVATE OTHER CONTEXT', payload['messages'][0]['content'])
        self.assertEqual(payload['temperature'], 0.1)

    def test_symbol_index_is_read_only(self):
        symbols, imports = coding._source_index('main.py',
            'import json\nfrom pathlib import Path\nclass Store:\n    def load(self):\n        pass\n')
        self.assertIn('Store', symbols)
        self.assertIn('load', symbols)
        self.assertIn('json', imports)
        self.assertIn('pathlib', imports)
        symbols, imports = coding._source_index('index.ts',
            'export function findUser() {}\nimport value from "./data"\n')
        self.assertIn('findUser', symbols)
        self.assertIn('./data', imports)

    def test_token_estimate_is_positive_and_bounded(self):
        self.assertEqual(coding._token_estimate('abcdef'), 2)
        with self.assertRaises(ValueError):
            model_behavior.system_prompt('unknown')


class GGUFMetadataTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory(prefix='gguf_header_')
        self.addCleanup(self.tmp.cleanup)
        self.model = Path(self.tmp.name)/'synthetic.gguf'

    def test_actual_gguf_header_metadata_not_model_quality(self):
        entries = [
            kv_string('general.architecture', 'llama'),
            kv_string('general.name', 'Synthetic Test'),
            kv_uint('llama.context_length', 4096),
            kv_string('tokenizer.chat_template', '{{ user }}')
        ]
        self.model.write_bytes(b'GGUF' + struct.pack('<IQQ',3,1,len(entries)) + b''.join(entries))
        result = gguf_diagnostics.inspect_file(self.model)
        self.assertTrue(result['metadata_recognized'])
        self.assertEqual(result['architecture'],'llama')
        self.assertEqual(result['context_length'],4096)
        self.assertTrue(result['chat_template_present'])
        self.assertIsNone(result['runtime_compatible'])
        self.assertFalse(result['coding_benchmark_passed'])

    def test_rejects_forged_or_oversized_metadata(self):
        self.model.write_bytes(b'not a GGUF format at all')
        with self.assertRaises(gguf_diagnostics.GGUFInspectionError):
            gguf_diagnostics.inspect_file(self.model)
        self.model.write_bytes(b'GGUF' + struct.pack('<IQQ',3,0,9000))
        with self.assertRaisesRegex(gguf_diagnostics.GGUFInspectionError,'key count'):
            gguf_diagnostics.inspect_file(self.model)

    def test_preflight_fails_open_for_header_incompatibility_only_as_advisory(self):
        original=(core.MODELS,core.DATA,core.DB,core.WORKSPACE)
        self.addCleanup(lambda: self._restore(original))
        base=Path(self.tmp.name)
        core.MODELS=base/'models';core.DATA=base/'data'
        core.DB=core.DATA/'db.sqlite3';core.WORKSPACE=base/'workspace'
        core.init()
        (core.MODELS/'unknown.gguf').write_bytes(b'GGUF'+b'\0'*8192)
        with patch.object(core,'available_physical_memory_bytes',return_value=16*1024**3):
            p=core.model_start_preflight('unknown.gguf')
        self.assertTrue(p['ram_check_passed'])
        self.assertFalse(p['metadata']['metadata_recognized'])
        self.assertFalse(p['metadata']['coding_benchmark_passed'])

    @staticmethod
    def _restore(old):
        core.MODELS,core.DATA,core.DB,core.WORKSPACE=old


if __name__ == '__main__':
    unittest.main(verbosity=2)
