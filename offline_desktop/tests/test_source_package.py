"""Source package must exclude secret/live state and verify its own manifests."""
import hashlib,json,tempfile,unittest,zipfile
from pathlib import Path
from scripts import build_source_candidate as pack

class SourceArchiveTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup)
        self.root=Path(self.tmp.name)/'source';self.root.mkdir();self.root=self.root.resolve()
        for name,data in [('app.py','print(1)'),('engine/core.py','value=1'),
                          ('data/access-token.txt','PRIVATE'),('data/theorg.sqlite3','DB'),
                          ('models/real.gguf','GGUF'),('workspace/private.md','SECRET')]:
            p=self.root/name;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(data)
    def test_excludes_live_data_and_model_weights(self):
        canonical_root=self.root.resolve()
        names=[p.relative_to(canonical_root).as_posix() for p in pack.files(self.root)]
        self.assertIn('engine/core.py',names)
        for name in ('data/access-token.txt','data/theorg.sqlite3','models/real.gguf',
                     'workspace/private.md'):
            self.assertNotIn(name,names)
    def test_manifest_checksum_and_source_only_status(self):
        dest=Path(self.tmp.name)/'candidate.zip'
        result=pack.build(dest,self.root,run_tests=False)
        with zipfile.ZipFile(dest) as z:
            m=json.loads(z.read('TheOrg/RELEASE-MANIFEST.json'))
            for name,checksum in m['files'].items():
                self.assertEqual(checksum,hashlib.sha256(z.read('TheOrg/'+name)).hexdigest())
            self.assertEqual(m['windows_exe'],'not_tested')
        self.assertEqual(result['zip_sha256'],hashlib.sha256(dest.read_bytes()).hexdigest())
    def test_cannot_write_release_into_source(self):
        with self.assertRaises(ValueError):pack.build(self.root/'out.zip',self.root,False)

if __name__=='__main__':unittest.main()
