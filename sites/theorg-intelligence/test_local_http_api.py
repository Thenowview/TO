"""Unit-test local HTTP route gates without a listening server or real credentials."""
import importlib.util
import io
import json
import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace

HERE=Path(__file__).resolve().parent
spec=importlib.util.spec_from_file_location("theorg_http_runtime",HERE/"local-task-runtime.py")
runtime=importlib.util.module_from_spec(spec)
spec.loader.exec_module(runtime)

def actor(role, name):
    return {"role":role,"actor":name,"tenant":"tenantA","company":"companyA"}

class LocalHttpContractTests(unittest.TestCase):
    def setUp(self):
        self.temp=tempfile.TemporaryDirectory()
        self.db=runtime.connect(Path(self.temp.name)/"tasks.sqlite3")
        self.owner=actor("analyst","creator")
        self.executive=actor("executive","executive")
        self.worker=actor("runtime","worker")
        self.reviewer=actor("reviewer","reviewer")
        self.id=runtime.create(self.db,self.owner,{
          "title":"Synthetic project KPI task","tool":"kpi-variance",
          "inputs":{"rows":[{"name":"Delivery","actual":83,"target":90}]}})["id"]
        runtime.move(self.db,self.executive,self.id,"approve")
        runtime.move(self.db,self.worker,self.id,"run")
    def tearDown(self):
        self.db.close()
        self.temp.cleanup()
    def request(self,identity,method,path,body=None):
        payload=json.dumps(body).encode() if body is not None else b""
        results=[]
        fake=SimpleNamespace(
            identity=lambda:identity,
            headers={"Content-Length":str(len(payload))},
            command=method,path=path,rfile=io.BytesIO(payload),
            server=SimpleNamespace(db=self.db),
            reply=lambda status,record:results.append((status,record)))
        runtime.Service.handle_action(fake)
        self.assertEqual(len(results),1)
        return results[0]
    def test_reviewer_can_inspect_matching_digest(self):
        status,data=self.request(self.reviewer,"GET",f"/v1/tasks/{self.id}/evidence")
        self.assertEqual(status,200)
        self.assertTrue(data["integrity_matches"])
        self.assertFalse(data["source_provenance_verified"])
    def test_reviewer_requires_explicit_acceptance(self):
        status,_=self.request(self.reviewer,"POST",f"/v1/tasks/{self.id}/accept",{})
        self.assertEqual(status,403)
        self.assertEqual(runtime.get(self.db,self.reviewer,self.id)["status"],"awaiting-qa")
    def test_wrong_digest_cannot_accept(self):
        status,_=self.request(self.reviewer,"POST",f"/v1/tasks/{self.id}/accept",
            {"review_confirmed":True,"evidence_digest":"sha256:"+"0"*64})
        self.assertEqual(status,403)
    def test_reviewer_receipt_allows_local_acceptance_but_not_source_verification(self):
        digest=runtime.evidence_for_review(self.db,self.reviewer,self.id)["stored_digest"]
        status,response=self.request(self.reviewer,"POST",f"/v1/tasks/{self.id}/accept",
            {"review_confirmed":True,"evidence_digest":digest})
        self.assertEqual(status,200)
        self.assertEqual(response["status"],"accepted")
        board=runtime.dashboard(self.db,self.reviewer)
        self.assertEqual(board["locally_accepted"],1)
        self.assertEqual(board["business_verified"],0)
        self.assertEqual(board["not_verified"],1)
    def test_cross_company_and_wrong_role_cannot_inspect(self):
        status,_=self.request(self.owner,"GET",f"/v1/tasks/{self.id}/evidence")
        self.assertEqual(status,403)
        other=actor("reviewer","other")
        other["company"]="differentCompany"
        status,_=self.request(other,"GET",f"/v1/tasks/{self.id}/evidence")
        self.assertEqual(status,404)
        status,_=self.request(self.reviewer,"GET",f"/v1/tasks/{self.id}/evidence?company=another")
        self.assertEqual(status,400)
    def test_untrusted_malformed_body_is_rejected(self):
        status,_=self.request(self.reviewer,"POST",f"/v1/tasks/{self.id}/accept",[])
        self.assertEqual(status,400)

if __name__=="__main__":
    unittest.main()
