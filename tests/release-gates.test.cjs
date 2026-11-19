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

test("bot merges dispatch trusted main checks and integrated-branch cleanup without bypassing release gates",()=>{
  const mergeWorkflow=fs.readFileSync(path.join(__dirname,"..",".github","workflows","safe-auto-merge.yml"),"utf8");
  for(const workflow of ["bridge-ci.yml","portable-chrome-ci.yml","onefile-existing-chrome-ci.yml","chromium-browser-ci.yml"]){
    assert.ok(mergeWorkflow.includes('gh workflow run '+workflow+' --repo "$GH_REPO" --ref "$BASE"'),workflow+" main handoff required");
  }
  assert.ok(mergeWorkflow.includes('gh workflow run retire-integrated-branches.yml --repo "$GH_REPO" --ref "$BASE"'));
  assert.ok(mergeWorkflow.includes("actions: write"));
  assert.ok(mergeWorkflow.includes('reviewDecision'));
  assert.ok(mergeWorkflow.includes('release-approved'));
  assert.ok(mergeWorkflow.includes('--match-head-commit'));
  assert.equal(policy.productionReady,false);
});

test("all four Windows/Chrome suites trigger guarded merge re-evaluation",()=>{
  const w=fs.readFileSync(path.join(__dirname,"..",".github","workflows","safe-auto-merge.yml"),"utf8");
  assert.ok(w.includes('workflow_run:'));
  for(const name of [
    'TheOrg Chrome and Windows Bridge CI',
    'TheOrg Portable Existing Chrome CI',
    'TheOrg Single EXE - Existing Chrome',
    'TheOrg Offline Chromium Browser'
  ]) assert.ok(w.includes(name),name+' should trigger immediate eligibility check');
  assert.ok(w.includes('pull_request_review:'));
});

test("owner-waived routine merges preserve GitHub rules and separate release-control review",()=>{
  const workflow=fs.readFileSync(path.join(__dirname,"..",".github","workflows","safe-auto-merge.yml"),"utf8");
  assert.ok(workflow.includes('decision=$(jq -r \'.reviewDecision // ""\' <<<"$data")'));
  assert.ok(workflow.includes('"CHANGES_REQUESTED" && "$decision" != "REVIEW_REQUIRED"'));
  assert.ok(workflow.includes('gh pr view "$pr" --repo "$GH_REPO" --json files'));
  // Non-executable audit Markdown may bypass an optional review. Code never may.
  const routine = workflow.match(/length > 0 and all\(\.\[\]; test\("([^"]+)"\)\)/);
  assert.ok(routine, "must require every changed path to belong to one closed routine class");
  assert.ok(workflow.includes("if ! jq -e 'length > 0 and all("));
  const allowed = new RegExp(routine[1]);
  assert.ok(allowed.test("docs/gize-audits/STATUS-2026-11-19.md"));
  for(const sensitive of [
    "apps/chrome-extension/manifest.json",
    "apps/chrome-extension/background.js",
    "engine/bridge/LocalAgentEngine.cs",
    "config/release-gates.json",
    ".github/workflows/safe-auto-merge.yml",
    ".github/workflows/bridge-ci.yml",
    "tests/release-gates.test.cjs",
    "tools/check-release-readiness.cjs",
    "docs/GIZE-OWNER-INSTRUCTIONS.md",
    "docs/gize-audits/../../engine/bridge/Program.cs"
  ]) assert.equal(allowed.test(sensitive),false,"requires reviewed merge: "+sensitive);
  assert.ok(workflow.includes('[[ "$decision" == "APPROVED" ]] || continue'));
  assert.ok(workflow.includes('reviews=$(gh api --paginate'));
  assert.ok(workflow.includes('release-approved'));
  assert.ok(workflow.includes('gh pr checks "$pr"'));
  assert.ok(workflow.includes('--json name,state'));
  assert.ok(workflow.includes('all($required[]; . as $name | ($passed | index($name)) != null)'));
  for(const job of ["portable","onefile-windows","windows-bridge","js-syntax","build"])
    assert.ok(workflow.includes('"'+job+'"'),"Unattended merge must await "+job);
  assert.ok(workflow.includes('gh pr merge "$pr"'));
  assert.equal(policy.productionReady,false);
});

test("Chromium developer preview bundles a verified upstream root license without live GitHub scraping",()=>{
  const root=path.join(__dirname,"..");
  const license=fs.readFileSync(path.join(root,"licenses","chromium","LICENSE"),"utf8");
  const ci=fs.readFileSync(path.join(root,".github","workflows","chromium-browser-ci.yml"),"utf8");
  assert.ok(license.length>=1000);
  assert.match(license,/Chromium Authors/);
  assert.match(license,/Redistribution and use/);
  assert.ok(ci.includes("$licenseSource='licenses/chromium/LICENSE'"));
  assert.ok(ci.includes("Copy-Item -LiteralPath $licenseSource -Destination 'out/browser/LICENSE' -Force"));
  assert.doesNotMatch(ci,/Invoke-WebRequest[^\\n]*raw[.]githubusercontent[.]com\\/chromium\\/chromium\\/main\\/LICENSE/);
});
