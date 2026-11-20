import test from "node:test";
import assert from "node:assert/strict";
import {decideAO} from "../src/ao-policy.mjs";
const tool={id:"ao.read",enabled:true,risk:"read",transport:"native"};
const identity={authenticated:true,principalId:"tester",tenantId:"synthetic",entitled:true,tenantAuthorized:true,allowedToolIds:["ao.read"]};
const run=(t={},i={},a,request)=>decideAO({tool:{...tool,...t},identity:{...identity,...i},approval:a,request});
test("read allowed",()=>assert.equal(run().verdict,"ALLOW"));
test("disabled fails closed",()=>assert.equal(run({enabled:false}).verdict,"DENY"));
test("missing identity fails closed",()=>assert.equal(run({}, {principalId:""}).verdict,"DENY"));
test("cross tenant fails closed",()=>assert.equal(run({}, {tenantAuthorized:false}).verdict,"DENY"));
test("entitlement required",()=>assert.equal(run({}, {entitled:false}).verdict,"DENY"));
test("tool ID allowlist required",()=>assert.equal(run({id:"ao.other"}).verdict,"DENY"));
test("unknown risk denied",()=>assert.equal(run({risk:"unknown"}).verdict,"DENY"));
test("external write asks a human",()=>assert.equal(run({risk:"external_write"}).verdict,"ASK"));
test("AI-only approval not sufficient",()=>assert.equal(run({risk:"external_write"},{},{autoApproved:true}).verdict,"ASK"));
test("verified human approval allows only a matching request and principal",()=>{
  const request={requestId:"synthetic-req-001"};
  const approval={approvedByHuman:true,verifiedForRequest:true,requestId:request.requestId,toolId:"ao.read",tenantId:"synthetic",principalId:"tester"};
  assert.equal(run({risk:"external_write"},{},approval,request).verdict,"ALLOW");
  for(const change of [{requestId:"different-req"},{toolId:"ao.other"},{tenantId:"different"},{principalId:"attacker"},{approvedByHuman:false},{verifiedForRequest:false}]){
    assert.equal(run({risk:"external_write"},{},{...approval,...change},request).verdict,"ASK");
  }
  assert.equal(run({risk:"external_write"},{},approval).verdict,"ASK");
});
test("local unapproved host denied",()=>assert.equal(run({transport:"mcp_stdio"}).verdict,"DENY"));
test("remote endpoint allowlist denied by default",()=>assert.equal(run({transport:"mcp_http"},{endpoint:"https://other.example"}).verdict,"DENY"));
test("approved HTTPS MCP read permitted",()=>assert.equal(run({transport:"mcp_http"},{endpoint:"https://known.example/mcp",allowedMcpEndpoints:["https://known.example/mcp"]}).verdict,"ALLOW"));
test("privileged tool always asks absent verified human grant",()=>assert.equal(run({risk:"privileged"}).verdict,"ASK"));
test("unknown transport fails closed",()=>assert.equal(run({transport:"unknown"}).verdict,"DENY"));
test("unbound approval cannot authorize privileged execution",()=>assert.equal(run({risk:"privileged"},{},{approvedByHuman:true,verifiedForRequest:true}).verdict,"ASK"));

test("authorization flags must be boolean true, not truthy claims",()=>{
  for(const value of ["false","true",1,[],{}]) {
    assert.equal(run({enabled:value}).verdict,"DENY");
    for(const field of ["authenticated","entitled","tenantAuthorized"])
      assert.equal(run({}, {[field]:value}).verdict,"DENY");
    assert.equal(run({transport:"mcp_stdio"},{approvedNativeHost:value}).verdict,"DENY");
    assert.equal(run({risk:"reversible_write"},{routineWriteAllowed:value}).verdict,"ASK");
  }
});
test("allowlists must be arrays rather than substring matches",()=>{
  assert.equal(run({}, {allowedToolIds:"prefix-ao.read-suffix"}).verdict,"DENY");
  assert.equal(run({transport:"mcp_http"},{endpoint:"https://known.example/mcp",
    allowedMcpEndpoints:"https://known.example/mcp/other"}).verdict,"DENY");
});
test("approved MCP endpoint must be a valid credential-free HTTPS URL",()=>{
  for(const endpoint of ["https://", "https://user:secret@known.example/mcp",
    "https://known.example/mcp#fragment", "https://known.example/mcp\n",
    "https://known.example\\@evil.example/mcp"]) {
    assert.equal(run({transport:"mcp_http"},{endpoint,allowedMcpEndpoints:[endpoint]}).verdict,"DENY");
  }
});

