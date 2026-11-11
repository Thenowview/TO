"""The release diagnostics CLI must be executable and fail closed."""
import json,subprocess,sys,tempfile,unittest
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
class ReadinessCliTests(unittest.TestCase):
    def test_direct_invocation_works(self):
        with tempfile.TemporaryDirectory() as tmp:
            target=Path(tmp)/'report.json'
            run=subprocess.run([sys.executable,'scripts/readiness_report.py','--output',str(target)],
                               cwd=ROOT,capture_output=True,text=True,timeout=20)
            self.assertEqual(run.returncode,0,run.stderr)
            report=json.loads(target.read_text())
            self.assertEqual(report['overall'],'not_release_ready')
            self.assertEqual(report['checks']['model']['status'],'not_verified')
    def test_strict_mode_rejects_missing_runtime_proof(self):
        run=subprocess.run([sys.executable,'scripts/readiness_report.py','--strict'],
                           cwd=ROOT,capture_output=True,text=True,timeout=20)
        self.assertNotEqual(run.returncode,0)
if __name__=='__main__':unittest.main()
