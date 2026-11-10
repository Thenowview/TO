#!/usr/bin/env node
/* TheOrg release eligibility check.
 * Passing build/unit tests is not permission to publish an unsigned, unintegrated
 * production application. The checklist is intentionally fail-closed.
 */
"use strict";
const fs=require("node:fs");
const path=require("node:path");
const policy=JSON.parse(fs.readFileSync(
  path.join(__dirname,"..","config","release-gates.json"),"utf8"));
const blockers=Object.entries(policy.gates||{}).filter(([,status])=>status!=="passed");
const infrastructure=policy.productionTarget || {};
const ready=policy.productionReady===true &&
  policy.decision==="GO" &&
  infrastructure.configured===true &&
  infrastructure.verifiedDeploymentWorkflow===true &&
  blockers.length===0;
const result={
  product:policy.product,
  releaseChannel:policy.releaseChannel,
  productionReady:ready,
  status:ready?"GO":"NO_GO",
  checks:Object.keys(policy.gates||{}).length,
  blockers:blockers.map(([gate,status])=>({gate,status})),
  productionTargetConfigured:infrastructure.configured===true
};
if(process.argv.includes("--json"))process.stdout.write(JSON.stringify(result,null,2)+"\n");
else {
  console.log("TheOrg release audit: "+result.status);
  console.log("Checks: "+result.checks+" | Blockers: "+blockers.length);
  for(const [gate,status] of blockers)console.log(" - "+gate+": "+status);
}
if(process.argv.includes("--production")&&!ready)process.exitCode=2;
