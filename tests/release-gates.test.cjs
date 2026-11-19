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

test("Windows Chromium licence is fetched from authoritative Gitiles with verified bytes",()=>{
  const workflow=fs.readFileSync(path.join(__dirname,"..",".github","workflows","chromium-browser-ci.yml"),"utf8");
  assert.ok(workflow.includes("https://chromium.googlesource.com/chromium/src/+/refs/heads/main/LICENSE?format=TEXT"));
  assert.ok(workflow.includes("[Convert]::FromBase64String"));
  assert.ok(workflow.includes("$attempt -le 3"),"licence fetch retries are bounded");
  assert.ok(workflow.includes("$licenseBytes.Length -lt 500"));
  assert.ok(workflow.includes("Chromium Authors"));
  assert.ok(workflow.includes("Redistribution"));
  assert.ok(!workflow.includes("raw.githubusercontent.com/chromium/chromium/main/LICENSE"),"avoid GitHub raw rate limits");
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

test("release destination must be DNS-named HTTPS, never local or IP-literal",()=>{
  for(const valid of ["https://release.example.org/orgaiz","https://downloads.orgaiz.com:443/v1",
                       "https://xn--bcher-kva.example.org/preview"]){
    assert.equal(isVerifiedHttpsDestination(valid),true,valid);
  }
  for(const unsafe of [
    "https://[::1]/","https://[fe80::1]/","https://[2001:db8::1]/",
    "https://127.0.0.2/","https://127.1/","https://10.0.0.3/",
    "https://169.254.169.254/latest/meta-data/","https://192.168.1.2/",
    "https://localhost./","https://agent.localhost/",
    "https://host.local/","https://host.localdomain/","https://intranet/",
    "https://bad..example.org/","https://user:pass@release.example.org/"
  ]){
    assert.equal(isVerifiedHttpsDestination(unsafe),false,unsafe);
    const candidate=syntheticApprovedShape();
    candidate.productionTarget.address=unsafe;
    assert.equal(evaluatePolicy(candidate,candidate.evidenceCommit).status,"NO_GO",unsafe);
  }
});

test("production GO requires a current matching build-commit attestation",()=>{
  const candidate=syntheticApprovedShape();
  for(const missing of [null,undefined,"",0,"bad-sha","0".repeat(39)]){
    const result=evaluatePolicy(candidate,missing);
    assert.equal(result.status,"NO_GO",String(missing));
    assert.ok(result.blockers.some(b=>b.gate==="evidence_commit" &&
      b.status==="current_build_commit_required"));
  }
  assert.equal(evaluatePolicy(candidate,"b".repeat(40)).status,"NO_GO");
  assert.equal(evaluatePolicy(candidate,candidate.evidenceCommit).status,"GO");
  assert.equal(evaluatePolicy(policy).status,"NO_GO",
    "Committed production config remains blocked regardless of unit fixtures");
});

test("production destination preflight denies special-use DNS names",()=>{
  const blocked=[
    "https://host.internal/releases",
    "https://node.lan/",
    "https://home.arpa/",
    "https://server.home.arpa/download",
    "https://example.test/",
    "https://account.invalid/",
    "https://service.onion/",
    "https://demo.example/",
    "https://example/"
  ];
  for(const url of blocked){
    assert.equal(isVerifiedHttpsDestination(url),false,url);
    const candidate=syntheticApprovedShape();
    candidate.productionTarget.address=url;
    assert.equal(evaluatePolicy(candidate,candidate.evidenceCommit).status,"NO_GO",url);
  }
  for(const url of ["https://download.orgaiz.com/release","https://releases.example.org/archive"])
    assert.equal(isVerifiedHttpsDestination(url),true,url);
  // DNS ownership, certificate and live route remain independent release gates.
  assert.equal(evaluatePolicy(policy).status,"NO_GO");
});
