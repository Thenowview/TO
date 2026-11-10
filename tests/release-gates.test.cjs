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
