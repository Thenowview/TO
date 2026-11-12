"use strict";
/* Three-edition Adaptive source and UI contract; does not claim real inference. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
const registry=JSON.parse(read("config/adaptive-model-registry.json"));
const html=read("offline_desktop/static/index.html");
const js=read("offline_desktop/static/app.js");
const api=read("offline_desktop/app.py");
const build=read("offline_desktop/Build-TheOrg-Portable-Windows.ps1");

test("Registry has one Nano, Lite and Advanced edition and a dedicated 2B slot",()=>{
  assert.deepEqual(registry.tiers.map(t=>t.id),["nano","lite","advanced"]);
  assert.deepEqual(registry.tiers.map(t=>t.edition),[1,2,3]);
  assert.equal(registry.tiers[0].mode,"model-free");
  assert.equal(registry.tiers[1].mode,"optional-local-gguf");
  const entry=registry.models.find(m=>m.id==="qwen35_2b");
  assert.ok(entry);
  assert.equal(entry.tier,"lite");
  assert.equal(entry.parameter_class,"2B");
  assert.equal(entry.verified_inference,false);
  assert.equal(entry.weight_state,"candidate_not_downloaded");
});

test("No edition claims bundled weights, verified inference or released Android app",()=>{
  assert.equal(registry.policies.automatic_download,false);
  assert.equal(registry.policies.auto_weight_training,false);
  assert.equal(registry.policies.real_inference_required_for_benchmark,true);
  for(const tier of registry.tiers){
    assert.equal(tier.platforms.android,"not_packaged");
    assert.equal(tier.weights_included,false);
  }
  assert.ok(registry.models.every(m=>m.verified_inference===false));
  assert.equal(registry.validation.real_gguf,"not_verified");
  assert.equal(registry.validation.windows_installer,"not_verified");
});

test("Edition selection, knowledge lookup and user-confirmed APIs are wired",()=>{
  for(const id of ["adaptiveEditionList","adaptiveFind","adaptiveQuery","adaptiveResults"]){
    assert.ok(html.includes('id="'+id+'"'),"Missing Adaptive UI element "+id);
  }
  for(const route of ["/api/adaptive/select","/api/adaptive/resolve",
                       "/api/adaptive/solutions/propose",
                       "/api/adaptive/solutions/from-task",
                       "/api/adaptive/solutions/review"]){
    assert.ok(api.includes(route),"Missing Adaptive API route "+route);
  }
  assert.ok(js.includes("function loadAdaptive"));
  assert.ok(js.includes("function searchAdaptive"));
  assert.ok(js.includes("confirmed:true"));
  assert.ok(js.includes("External agents and websites require separate approval"));
});

test("Canonical registry is in Windows binary and optional standalone source ZIP",()=>{
  assert.ok(build.includes("config\\adaptive-model-registry.json;config"));
  assert.ok(read("offline_desktop/scripts/build_source_candidate.py")
    .includes("config/adaptive-model-registry.json"));
  assert.ok(read("offline_desktop/engine/adaptive_runtime.py")
    .includes("REGISTRY = next("));
});

test("Source integrity and training output remain explicitly unverified",()=>{
  const integrity=read("tools/adaptive_integrity.py");
  const training=read("tools/prepare-adaptive-training.py");
  assert.ok(integrity.includes("Stale or tampered SHA-256"));
  assert.ok(integrity.includes("Nested compressed assets"));
  assert.ok(training.includes("status='verified'"));
  assert.ok(training.includes("Explicit --confirm-reviewed-export"));
  assert.ok(training.includes('"adapter_trained":False'));
});
