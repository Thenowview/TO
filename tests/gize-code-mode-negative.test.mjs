import test from "node:test";
import assert from "node:assert/strict";
import { createGizeCodeMode } from "../code-mode/gateway.mjs";
const context={jobId:"job-12345", principalId:"user-12345", tenantId:"tenant-12345"};
const tools=[{id:"gize.read",risk:"read",description:"Synthetic read operation"}];
const runner={kind:"isolated_worker",async run({callTool}){return callTool("gize.read",{});}};
test("discovery callback failures fail closed without leaking tool descriptions", async()=>{
  const gateway=createGizeCodeMode({
    tools,canDiscover:async()=>{throw Error("secret internal exception")}
  });
  const result=await gateway.search({query:"synthetic"},context);
  assert.equal(result.ok,false);
  assert.equal(result.error,"discovery_policy_unavailable");
  assert.ok(!JSON.stringify(result).includes("secret"));
});
test("top level authorization callback failures fail closed",async()=>{
  const gateway=createGizeCodeMode({
    tools,runner,authorize:async()=>{throw Error("secret authorization error")},
    invoke:async()=>{throw Error("must not be called")}
  });
  const result=await gateway.execute({code:"test"},context);
  assert.equal(result.ok,false);
  assert.equal(result.error,"code_execution_not_authorized");
});
test("per operation authorization callback failures never invoke tools",async()=>{
  let called=0;
  const gateway=createGizeCodeMode({
    tools,runner,
    authorize:async({action})=>action==="execute_code"?{allow:true}:Promise.reject(Error("secret policy failure")),
    invoke:async()=>{called++;return "unexpected"}
  });
  const result=await gateway.execute({code:"test"},context);
  assert.equal(result.ok,true);
  assert.equal(result.result.ok,false);
  assert.equal(result.result.error,"tool_execution_not_authorized");
  assert.equal(called,0);
});

test("worker argument mutation cannot change authorized invocation",async()=>{
 const original={path:"reviewed.txt",nested:{scope:"job-only"}};
 let invoked;
 const gateway=createGizeCodeMode({
  tools,runner:{kind:"isolated_worker",async run({callTool}){return callTool("gize.read",original);}},
  authorize:async({action,args})=>{
   if(action==="invoke"){
    assert.equal(args.path,"reviewed.txt");
    original.path="changed.txt"; original.nested.scope="other-job";
    await Promise.resolve();
   }
   return {allow:true};
  },
  invoke:async({args})=>{invoked=args;return "synthetic";}
 });
 const result=await gateway.execute({code:"synthetic"},context);
 assert.equal(result.result.ok,true);
 assert.deepEqual(invoked,{path:"reviewed.txt",nested:{scope:"job-only"}});
});
