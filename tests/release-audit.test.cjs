const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {spawnSync} = require("node:child_process");
const root=path.resolve(__dirname,"..");
const audit=path.join(root,"tools","generate-release-audit.cjs");
const out=path.join(root,"out","release-audit");

test("automated preflight is provenance-linked and never calls unsigned preview production",()=>{
  const sha="b".repeat(40);
  const r=spawnSync(process.execPath,[audit],{
    cwd:root,encoding:"utf8",
    env:{...process.env,GITHUB_SHA:sha,GITHUB_RUN_ID:"4242",GITHUB_REPOSITORY:"faisalwrokksa-hub/TO",
      GITHUB_STEP_SUMMARY:""}
  });
  assert.equal(r.status,0,r.stderr);
  const value=JSON.parse(fs.readFileSync(path.join(out,"release-preflight.json"),"utf8"));
  const markdown=fs.readFileSync(path.join(out,"release-preflight.md"),"utf8");
  assert.equal(value.sourceCommit,sha);
  assert.equal(value.githubRunId,"4242");
  assert.equal(value.calculatedStatus,"NO_GO");
  assert.equal(value.productionDeploymentExecuted,false);
  assert.ok(value.blockers.some(b=>b.gate==="production_deployment_destination"));
  assert.ok(value.blockers.some(b=>b.gate==="evidence_commit"));
  assert.match(markdown,/Deployment executed:\*\* NO/);
  assert.match(markdown,/not independent proof/i);
});

test("release preflight remains fail-closed without a source commit",()=>{
  const env={...process.env,GITHUB_SHA:"unknown",GITHUB_RUN_ID:"",GITHUB_REPOSITORY:"",
    GITHUB_STEP_SUMMARY:""};
  const r=spawnSync(process.execPath,[audit],{cwd:root,encoding:"utf8",env});
  assert.equal(r.status,0,r.stderr);
  const value=JSON.parse(fs.readFileSync(path.join(out,"release-preflight.json"),"utf8"));
  assert.equal(value.sourceCommit,null);
  assert.equal(value.calculatedStatus,"NO_GO");
  assert.ok(value.blockers.some(b=>b.gate==="source_commit"));
});
