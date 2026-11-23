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

test("retained callback is denied after runner completion or failure",async()=>{
 for(const fails of [false,true]){
  let retained,invocations=0;
  const gateway=createGizeCodeMode({
   tools,runner:{kind:"isolated_worker",async run({callTool}){retained=callTool;if(fails)throw Error("synthetic");return "done";}},
   authorize:async()=>({allow:true}),invoke:async()=>{invocations++;return "unexpected";}
  });
  await gateway.execute({code:"synthetic"},context);
  assert.equal((await retained("gize.read",{})).error,"execution_closed");
  assert.equal(invocations,0);
 }
});
test("authorization completing after runner exit cannot dispatch",async()=>{
 let pending,release,invocations=0;
 const gate=new Promise(resolve=>{release=resolve;});
 const gateway=createGizeCodeMode({
  tools,runner:{kind:"isolated_worker",async run({callTool}){pending=callTool("gize.read",{});return "done";}},
  authorize:async({action})=>{if(action==="invoke")await gate;return {allow:true};},
  invoke:async()=>{invocations++;return "unexpected";}
 });
 await gateway.execute({code:"synthetic"},context);
 release();
 assert.equal((await pending).error,"execution_closed");
 assert.equal(invocations,0);
});

test("caller context mutation cannot switch tenant during authorization",async()=>{
 const original={...context};let seen;
 const gateway=createGizeCodeMode({tools,runner,
 authorize:async({action,context:scoped})=>{
  if(action==="execute_code"){original.tenantId="tenant-other";await Promise.resolve();}
  assert.equal(scoped.tenantId,context.tenantId);return {allow:true};
 },invoke:async({context:scoped})=>{seen=scoped.tenantId;return "synthetic";}});
 assert.equal((await gateway.execute({code:"synthetic"},original)).result.ok,true);
 assert.equal(seen,context.tenantId);
});
test("coercible identity objects are rejected without invoking policy",async()=>{
 let called=false;
 const gateway=createGizeCodeMode({tools,runner,authorize:async()=>{called=true;return {allow:true};},invoke:async()=>true});
 const malformed={...context,tenantId:{toString(){return "tenant-12345";}}};
 assert.equal((await gateway.execute({code:"synthetic"},malformed)).error,"trusted_context_required");
 assert.equal(called,false);
});

test("code cannot change while initial authorization waits",async()=>{
 const request={code:"reviewed-code"};let received;
 const gateway=createGizeCodeMode({tools,
 runner:{kind:"isolated_worker",async run({code}){received=code;return "done";}},
 authorize:async()=>{request.code="changed-code";await Promise.resolve();return {allow:true};},invoke:async()=>true});
 assert.equal((await gateway.execute(request,context)).ok,true);
 assert.equal(received,"reviewed-code");
});
