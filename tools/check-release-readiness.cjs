#!/usr/bin/env node
/* Fail-closed, evidence-bound release readiness validator.
 * A green CI build or a manually edited JSON file is not production acceptance.
 * The checker enforces required declared gates and deployment metadata; an
 * independent reviewer must still validate each piece of claimed evidence.
 */
"use strict";
const fs = require("node:fs");
const path = require("node:path");
const {isIP} = require("node:net");

const REQUIRED_GATES = Object.freeze([
  "ci_windows_native_controller",
  "ci_supervisor_ui_and_unit",
  "unsigned_installer_build",
  "installer_silent_smoke",
  "original_source_archives_imported",
  "legacy_sidebar_behavior_regression",
  "real_chrome_stable_native_host_e2e",
  "real_ai_provider_authorized_integration",
  "authenticated_independent_business_qa",
  "malware_scanning_and_safe_previews",
  "production_grade_security_and_tenant_auth",
  "release_binary_code_signing",
  "production_deployment_destination",
  "production_readback_smoke"
]);
const SHA40 = /^[a-f0-9]{40}$/i;

function isVerifiedHttpsDestination(value) {
  if (typeof value !== "string" || value.length > 2048) return false;
  try {
    const u = new URL(value);
    if (u.protocol !== "https:" || !u.hostname || u.username || u.password)
      return false;
    // Production preflight requires an unambiguous DNS hostname. IP literals
    // (including alternate loopback/IPv6 spellings) and local-only names are
    // not independently verified public HTTPS release destinations.
    // DNS ownership, certificate and route checks remain external release gates.
    const hostname = u.hostname.toLowerCase().replace(/\.$/, "");
    const literal = hostname.startsWith("[") && hostname.endsWith("]")
      ? hostname.slice(1, -1) : hostname;
    if (isIP(literal) !== 0 || hostname.length > 253 ||
        hostname === "localhost" || hostname.endsWith(".localhost") ||
        hostname.endsWith(".local") || hostname.endsWith(".localdomain") ||
        hostname.endsWith(".internal") || hostname.endsWith(".lan") ||
        hostname === "home.arpa" || hostname.endsWith(".home.arpa") ||
        hostname.endsWith(".test") || hostname.endsWith(".invalid") ||
        hostname.endsWith(".onion"))
      return false;
    const labels = hostname.split(".");
    return labels.length >= 2 &&
      labels.every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(label));
  } catch { return false; }
}

function evaluatePolicy(policy, buildCommit = null) {
  const p = policy && typeof policy === "object" && !Array.isArray(policy) ? policy : {};
  const gates = p.gates && typeof p.gates === "object" && !Array.isArray(p.gates) ? p.gates : {};
  const target = p.productionTarget && typeof p.productionTarget === "object" &&
    !Array.isArray(p.productionTarget) ? p.productionTarget : {};
  const blockers = [];
  for (const name of REQUIRED_GATES) {
    if (!Object.prototype.hasOwnProperty.call(gates, name))
      blockers.push({gate:name,status:"missing_required_gate"});
    else if (gates[name] !== "passed")
      blockers.push({gate:name,status:String(gates[name])});
  }
  for (const [name,status] of Object.entries(gates)) {
    if (!REQUIRED_GATES.includes(name) && status !== "passed")
      blockers.push({gate:name,status:String(status)});
  }
  if (p.schemaVersion !== 1) blockers.push({gate:"policy_schema",status:"invalid"});
  if (p.product !== "TheOrg") blockers.push({gate:"product_identity",status:"invalid"});
  if (p.releaseChannel !== "production") blockers.push({gate:"release_channel",status:"not_production"});
  if (p.decision !== "GO" || p.productionReady !== true)
    blockers.push({gate:"release_decision",status:"not_authorized_for_production"});
  if (target.configured !== true || target.verifiedDeploymentWorkflow !== true)
    blockers.push({gate:"deployment_workflow",status:"not_verified"});
  if (typeof target.kind !== "string" || !/^[a-z][a-z0-9-]{2,63}$/.test(target.kind))
    blockers.push({gate:"deployment_kind",status:"missing_or_invalid"});
  if (!isVerifiedHttpsDestination(target.address))
    blockers.push({gate:"deployment_destination_address",status:"missing_or_invalid_https_url"});
  if (typeof p.evidenceCommit !== "string" || !SHA40.test(p.evidenceCommit))
    blockers.push({gate:"evidence_commit",status:"missing_or_invalid"});
  // A manually edited policy is never an attestation of the currently built
  // commit. Refuse GO when the caller omits GITHUB_SHA or supplies a mismatch.
  if (typeof buildCommit !== "string" || !SHA40.test(buildCommit))
    blockers.push({gate:"evidence_commit",status:"current_build_commit_required"});
  else if (p.evidenceCommit !== buildCommit)
    blockers.push({gate:"evidence_commit",status:"not_this_build"});
  return {
    product:p.product ?? null,
    releaseChannel:p.releaseChannel ?? null,
    productionReady:blockers.length === 0,
    status:blockers.length === 0 ? "GO" : "NO_GO",
    checks:REQUIRED_GATES.length,
    blockers,
    productionTargetConfigured:target.configured === true,
    evidenceCommit:p.evidenceCommit ?? null,
    evaluatedBuildCommit:buildCommit || null,
    warning:"A GO result requires independent evidence review and real deployment read-back; this checker cannot independently certify external systems."
  };
}

if (require.main === module) {
  const policy = JSON.parse(fs.readFileSync(
    path.join(__dirname,"..","config","release-gates.json"),"utf8"));
  const result = evaluatePolicy(policy, process.env.GITHUB_SHA || null);
  if (process.argv.includes("--json")) process.stdout.write(JSON.stringify(result,null,2)+"\n");
  else {
    console.log("TheOrg production release audit: "+result.status);
    console.log("Required checks: "+result.checks+" | Blockers: "+result.blockers.length);
    for (const b of result.blockers) console.log(" - "+b.gate+": "+b.status);
  }
  if (process.argv.includes("--production") && !result.productionReady) process.exitCode = 2;
}

module.exports = {evaluatePolicy,REQUIRED_GATES,isVerifiedHttpsDestination};
