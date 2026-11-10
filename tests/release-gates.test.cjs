const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {spawnSync}=require("node:child_process");

const policy=JSON.parse(fs.readFileSync(path.join(__dirname,"..","config","release-gates.json"),"utf8"));
const checker=path.join(__dirname,"..","tools","check-release-readiness.cjs");

test("release policy is explicit and production fails closed",()=>{
  assert.equal(policy.schemaVersion,1);
  assert.equal(policy.productionReady,false);
  assert.equal(policy.productionTarget.configured,false);
  const blocked=Object.entries(policy.gates).filter(([,v])=>v!=="passed");
  assert.ok(blocked.length>=5,"Known release blockers must remain visible");
  assert.equal(policy.decision,"NO_GO");
});

test("production checker refuses an unverified release while developer preview audit reports accurately",()=>{
  const production=spawnSync(process.execPath,[checker,"--production","--json"],{encoding:"utf8"});
  assert.equal(production.status,2,production.stderr);
  const payload=JSON.parse(production.stdout);
  assert.equal(payload.productionReady,false);
  assert.ok(payload.blockers.some(b=>b.gate==="production_deployment_destination"));
  const preview=spawnSync(process.execPath,[checker,"--json"],{encoding:"utf8"});
  assert.equal(preview.status,0);
  assert.equal(JSON.parse(preview.stdout).status,"NO_GO");
});


const {evaluatePolicy,REQUIRED_GATES,isVerifiedHttpsDestination} =
  require("../tools/check-release-readiness.cjs");

function syntheticApprovedShape() {
  // Hypothetical unit-test fixture, NOT real production evidence or approval.
  const commit="a".repeat(40);
  return {
    ...structuredClone(policy),
    releaseChannel:"production",
    decision:"GO",
    productionReady:true,
    evidenceCommit:commit,
    productionTarget:{
      configured:true,
      verifiedDeploymentWorkflow:true,
      kind:"windows-installer-distribution",
      address:"https://release.example.org/theorg"
    },
    gates:Object.fromEntries(REQUIRED_GATES.map(g=>[g,"passed"]))
  };
}

test("release evaluator checks the complete required gate list, even when config is edited",()=>{
  const fixture=syntheticApprovedShape();
  const noGate=structuredClone(fixture);
  delete noGate.gates.original_source_archives_imported;
  const r=evaluatePolicy(noGate,fixture.evidenceCommit);
  assert.equal(r.status,"NO_GO");
  assert.ok(r.blockers.some(b=>b.gate==="original_source_archives_imported" &&
    b.status==="missing_required_gate"));
  assert.ok(REQUIRED_GATES.length>=14);
});

test("release evaluator rejects incomplete destination, identity, and mismatched evidence",()=>{
  const fixture=syntheticApprovedShape();
  assert.equal(evaluatePolicy(fixture,"b".repeat(40)).status,"NO_GO");
  for(const invalid of ["http://release.example.org","https://localhost",
       "https://user:pass@release.example.org","not a URL"]) {
    assert.equal(isVerifiedHttpsDestination(invalid),false);
    const broken=structuredClone(fixture);
    broken.productionTarget.address=invalid;
    assert.equal(evaluatePolicy(broken,fixture.evidenceCommit).status,"NO_GO");
  }
  const malformed=structuredClone(fixture);
  malformed.productionTarget.kind=null;
  assert.equal(evaluatePolicy(malformed,fixture.evidenceCommit).status,"NO_GO");
  assert.equal(evaluatePolicy({...fixture,releaseChannel:"developer-preview"},
    fixture.evidenceCommit).status,"NO_GO");
});

test("synthetic complete shape checks schema only and never certifies external evidence",()=>{
  const fixture=syntheticApprovedShape();
  const result=evaluatePolicy(fixture,fixture.evidenceCommit);
  assert.equal(result.status,"GO");
  assert.match(result.warning,/independent evidence review/);
  assert.equal(evaluatePolicy(policy).status,"NO_GO",
    "Real repository policy remains blocked");
});
