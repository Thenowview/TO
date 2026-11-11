"""Synthetic-only master compatibility gates, not physical-device or model testing."""
import json, struct, tempfile, unittest
from pathlib import Path
from unittest.mock import patch
from engine import core, coding, device_capabilities, gguf_diagnostics, model_behavior
G=1024**3

class MasterCompatibility(unittest.TestCase):
    def test_capability_tiers_are_advisory(self):
        for ram,tier in [(1*G,'below-minimum'),(2*G,'minimum'),(4*G,'basic'),(8*G,'enhanced'),(16*G,'workstation')]:
            data=device_capabilities.detect(ram,ram//2,cores=2,platform_name='test')
            self.assertEqual(data['tier'],tier)
            self.assertTrue(data['core_model_free'])
        self.assertFalse(device_capabilities.detect(2*G,1*G)['optional_local_llm'])

    def test_unknown_memory_refuses_model(self):
        ok,msg=device_capabilities.model_allowed(256*1024**2,None)
        self.assertFalse(ok)
        self.assertIn('could not',msg)
        ok,msg=device_capabilities.model_allowed(3*G,1*G)
        self.assertFalse(ok)
        ok,msg=device_capabilities.model_allowed(256*1024**2,3*G)
        self.assertTrue(ok)

    def test_role_prompts_versioned_and_memory_scope(self):
        self.assertEqual(set(model_behavior.ROLE_INSTRUCTIONS),set(core.PROFILES))
        self.assertIn('UNTRUSTED DATA',model_behavior.system_prompt('developer'))
        with patch.object(core,'active_backend',return_value=('llamacpp','local')),patch.object(core,'memories',return_value=[{'title':'PRIVATE','content':'OTHER PROJECT'}]),patch.object(core,'local_http_json',return_value={'choices':[{'message':{'content':'{"ok":true}'}}]}) as query:
            self.assertEqual(core.infer('Draft code', 'developer', structured=True),'{"ok":true}')
        wire=query.call_args.args[1]
        self.assertEqual(wire['response_format']['type'],'json_object')
        self.assertNotIn('OTHER PROJECT',wire['messages'][0]['content'])

    def test_header_only_does_not_claim_inference(self):
        def metadata(k,v):
            kb=k.encode();vb=v.encode()
            return struct.pack('<Q',len(kb))+kb+struct.pack('<IQ',8,len(vb))+vb
        b=b'GGUF'+struct.pack('<IQQ',3,1,2)+metadata('general.architecture','llama')+metadata('tokenizer.chat_template','{{ user }}')
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'synthetic.gguf';path.write_bytes(b)
            parsed=gguf_diagnostics.inspect_file(path)
            self.assertEqual(parsed['architecture'],'llama')
            self.assertTrue(parsed['chat_template_present'])
            self.assertIsNone(parsed['runtime_compatible'])
            self.assertFalse(parsed['inference_verified'])
            path.write_bytes(b'MALICIOUS')
            with self.assertRaises(gguf_diagnostics.GGUFInspectionError):gguf_diagnostics.inspect_file(path)

    def test_json_proposal_is_strict(self):
        self.assertEqual(coding._parse_model_changes('{"changes":[{"path":"x.py","content":"pass"}]}')[0]['path'],'x.py')
        for bad in ['[]','{"changes": [],"extra":"bad"}','{"changes": [{"path":"x.py","content":"x","shell":"rm -rf"}]}']:
            with self.assertRaises(core.EngineError):coding._parse_model_changes(bad)

if __name__=='__main__':unittest.main()
