#!/usr/bin/env node
/**
 * Machine-readable production preflight snapshot, not a production certification.
 * This never deploys, signs, uploads, or changes release approval state.
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const { evaluatePolicy } = require("./check-release-readiness.cjs");
const ROOT = path.resolve(__dirname, "..");
const SHA = /^[a-f0-9]{40}$/i;
const out = path.join(ROOT, "out", "release-audit");
const policy = JSON.parse(fs.readFileSync(path.join(ROOT,"config","release-gates.json"),"utf8"));
const rawCommit = process.env.GITHUB_SHA || "";
const buildCommit = SHA.test(rawCommit) ? rawCommit : null;
const verdict = evaluatePolicy(policy, buildCommit);
const blockers = verdict.blockers.slice();
if (!buildCommit) blockers.push({gate:"source_commit",status:"not_verified"});
const status = blockers.length === 0 ? "PREFLIGHT_DECLARED_GO_UNVERIFIED" : "NO_GO";
const runId = /^\d+$/.test(process.env.GITHUB_RUN_ID || "") ? process.env.GITHUB_RUN_ID : null;
const repository = process.env.GITHUB_REPOSITORY === "faisalwrokksa-hub/TO"
  ? process.env.GITHUB_REPOSITORY : null;
const record = {
  schemaVersion:1,
  subject:"TheOrg production preflight and developer-preview release audit",
  generatedAtUtc:new Date().toISOString(),
  sourceCommit:buildCommit,
  githubRunId:runId,
  repository,
  releaseChannel:policy.releaseChannel,
  releaseDecision:policy.decision,
  calculatedStatus:status,
  productionDeploymentExecuted:false,
  productionTarget:policy.productionTarget,
  gates:{...policy.gates},
  blockers,
  evidenceScope:[
    "This is a point-in-time policy/configuration snapshot, not independent proof that gates passed.",
    "CI jobs and artifacts must be separately checked on the exact commit after the run completes.",
    "No real Chrome/Windows end-user acceptance, AI-provider integration, signing or security assessment is inferred."
  ]
};
const lines=[
 "# TheOrg — Release preflight audit",
 "",
 "**Source commit:** "+(buildCommit || "unavailable"),
 "**GitHub Actions run:** "+(runId || "local execution"),
 "**Release channel:** "+String(record.releaseChannel),
 "**Production decision:** "+String(record.calculatedStatus),
 "**Deployment executed:** NO",
 "",
 "This report checks policy declarations, not the actual security or functional truth of those declarations.",
 "The latest CI jobs and artifacts must be verified separately after the workflow finishes.",
 "",
 "## Blocking release gates",
 ""
];
for (const item of blockers) {
 const key = String(item.gate).replace(/[^a-z0-9_\-]/gi,"_");
 const value = String(item.status).replace(/[\r\n|]/g," ");
 lines.push("- "+key+": "+value);
}
if (!blockers.length) lines.push("- No declared blockers, but independent pre-production validation is still required.");
lines.push("","## Required completion evidence","",
"- Authorized real deployment target and verified read-back/rollback",
"- Signed production binary and independent malware/security review",
"- Owner-PC Chrome Stable and Windows Native Messaging end-to-end acceptance",
"- Original-source migration and legacy regression evidence",
"- Live authorized provider integration and independent business-quality acceptance",
"",
"**Do not publish or install an unsigned developer-preview artifact as a production release.**","");
fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,"release-preflight.json"),JSON.stringify(record,null,2)+"\n");
fs.writeFileSync(path.join(out,"release-preflight.md"),lines.join("\n"));
process.stdout.write("RELEASE_PREFLIGHT="+status+" blockers="+blockers.length+"\n");
if (process.env.GITHUB_STEP_SUMMARY)
 fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY,lines.join("\n"));
module.exports = {record};
