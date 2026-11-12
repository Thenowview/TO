"use strict";
// Static contract tests; not a live provider or browser E2E test.
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ROOT=path.join(__dirname,"..");
const html=fs.readFileSync(path.join(ROOT,"offline_desktop","static","index.html"),"utf8");
const js=fs.readFileSync(path.join(ROOT,"offline_desktop","static","app.js"),"utf8");
const py=fs.readFileSync(path.join(ROOT,"offline_desktop","app.py"),"utf8");

test("Company agents view has all wired controls",()=>{
  const ids=["companyName","companyProject","companyObjective","companyTasks","companyModel",
    "companyCreate","companyRefresh","companyOrderList","companyRuntime",
    "companyAgentSelect","companyAgentName","companyAgentTitle",
    "companyAgentDepartment","companyAgentExpertise","companyAgentInstructions",
    "companyAgentEnabled","companyAgentSave"];
  for(const id of ids){
    assert.match(html,new RegExp('\\bid="'+id+'"'));
    assert.ok(js.includes("'"+id+"'"),"Missing JS element reference: "+id);
  }
  assert.match(html,/data-view="company"/);
  assert.match(html,/id="view-company"/);
  assert.match(js,/company:'Company agents'/);
});

test("API gateway requires local bearer authentication",()=>{
  assert.match(py,/if not self\._auth\(\):return/);
  assert.match(py,/path=='\/api\/company\/orders'/);
  assert.match(py,/path=='\/api\/company\/jobs\/dispatch'/);
  assert.match(py,/path=='\/api\/company\/qa\/run'/);
  assert.match(py,/path=='\/api\/company\/qa\/review'/);
  assert.match(py,/path=='\/api\/company\/jobs\/propose'/);
  assert.match(py,/path=='\/api\/company\/jobs\/export'/);
});

test("Client asks permission before provider transfer and code-plan promotion",()=>{
  assert.match(js,/This may transmit source/);
  assert.match(js,/provider costs may apply/i);
  assert.match(js,/Code Studio draft/);
  assert.match(js,/confirmed:true/);
  assert.doesNotMatch(js,/\beval\s*\(/);
});
