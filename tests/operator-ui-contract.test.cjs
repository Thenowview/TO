"use strict";
// Static contract: UI must never turn an instruction into an unapproved action.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const html = fs.readFileSync(path.join(ROOT, "offline_desktop/static/index.html"), "utf8");
const js = fs.readFileSync(path.join(ROOT, "offline_desktop/static/app.js"), "utf8");

test("Windows Operator view exposes reviewable instructions and history", () => {
  for (const id of ["view-operator", "operatorInstruction", "operatorPreview",
                    "operatorCatalog", "operatorHistory", "operatorRunId",
                    "operatorRunSha", "operatorVerifyRun"]) {
    assert.ok(html.includes('id="' + id + '"'), "Missing UI control " + id);
  }
  assert.match(html, /data-view="operator"/);
  assert.match(js, /operator:'Windows Operator'/);
});

test("Operator plan is a preview only; tool execution is an independent action", () => {
  assert.match(js, /request\('operator\/plan',\{method:'POST'/);
  assert.match(js, /request\('capabilities\/prepare',\{/);
  assert.match(js, /request\('capabilities\/execute',\{/);
  assert.match(js, /if\(!confirm\(label\)\)/);
  assert.match(js, /digest:p\.digest,confirmed:true/);
  assert.match(js, /No unattended follow-up actions/);
});

test("Operator output is rendered as text, never as HTML from a tool", () => {
  const operatorBlock = js.slice(js.indexOf("/* Windows Operator"), js.indexOf("async function refreshAll"));
  assert.ok(operatorBlock.length > 1000, "Operator UI logic missing");
  assert.doesNotMatch(operatorBlock, /\.innerHTML\s*=/);
  assert.doesNotMatch(operatorBlock, /insertAdjacentHTML/);
  assert.match(operatorBlock, /text\(\$\('operatorPlanStatus'\),JSON\.stringify\(outcome,null,2\)\)/);
});

test("Github workflow verification requires exact source commit and numeric run ID", () => {
  assert.match(js, /Number\.isSafeInteger\(runId\)/);
  assert.match(js, /\^\[0-9a-f\]\{40\}\$/);
  assert.match(js, /run_id:runId,expected_sha:sha/);
  assert.match(js, /github\.workflow\.result/);
});
