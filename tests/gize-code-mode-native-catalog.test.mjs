import test from "node:test";
import assert from "node:assert/strict";
import { describeNativeTools } from "../code-mode/native-catalog.mjs";
const descriptors = [
  ["write_note", "reversible_write", "native_allowlist"],
  ["read_note", "read_only", "native_allowlist"],
  ["list_notes", "read_only", "native_allowlist"],
  ["system_info", "read_only", "native_allowlist"],
  ["browser_open", "consequential_external", "browser_navigation_only"],
  ["windows_open_notepad", "consequential_external", "native_allowlist"]
].map(([id, riskClass, execution]) => ({
  id, version: 1, riskClass, requiresOwnerApproval: true,
  permissionScope: "company_order", execution, safeBatch: riskClass !== "consequential_external"
}));
const fixture = {
  ok: true, catalogVersion: "ao.local.tools.v1",
  mcpEnabled: false, remoteToolExecutionEnabled: false, toolDescriptors: descriptors
};
test("native catalog produces read-only metadata, not execution authority", () => {
  const r = describeNativeTools(fixture);
  assert.equal(r.ok, true);
  assert.equal(r.executionSupported, false);
  assert.equal(r.tools.length, 6);
  assert.equal(r.tools.find(t => t.id === "gize.native.browser_open").risk, "external_write");
  assert.equal(r.tools.every(t => t.requiresApproval), true);
  assert.ok(Object.isFrozen(r.tools));
});
test("rejected catalogs cannot inject tools, claims or authorizations", () => {
  for (const bad of [
    null, {}, {...fixture, mcpEnabled: true},
    {...fixture, catalogVersion: "unrecognized"},
    {...fixture, toolDescriptors: [...descriptors, {id:"gize.admin"}]},
    {...fixture, toolDescriptors: [...descriptors.slice(0,5), descriptors[0]]},
    {...fixture, toolDescriptors: descriptors.map((t,i) => i === 0 ? {...t, requiresOwnerApproval:false} : t)},
    Object.create(fixture)
  ]) {
    const r = describeNativeTools(bad);
    assert.equal(r.ok, false);
    assert.deepEqual(r.tools, []);
  }
});

test("every native tool rejects risk-class substitution",()=>{
 for(let i=0;i<descriptors.length;i++){
  for(const riskClass of ["read_only","reversible_write","consequential_external"]){
   if(riskClass===descriptors[i].riskClass)continue;
   const altered=descriptors.map((d,j)=>j===i?{...d,riskClass}:d);
   const result=describeNativeTools({...fixture,toolDescriptors:altered});
   assert.equal(result.ok,false,descriptors[i].id+" risk "+riskClass);
   assert.deepEqual(result.tools,[]);
  }
 }
});
