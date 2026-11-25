import test from "node:test";
import assert from "node:assert/strict";
import { createGizeCodeMode } from "../code-mode/gateway.mjs";

test("hanging admission times out, quarantines job and late approval cannot start runner", async () => {
  let approve;
  let runs=0;
  const gateway=createGizeCodeMode({
    executionTimeoutMs:25,
    runner:{kind:"isolated_worker",run:async()=>{runs++;return "unexpected";}},
    authorize:()=>new Promise(resolve=>{approve=resolve;}),
    invoke:async()=>null
  });
  const context={tenantId:"tenant1",principalId:"user001",jobId:"job001"};
  assert.deepEqual(await gateway.execute({code:"x"},context),{ok:false,error:"execution_timeout"});
  approve({allow:true});
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(runs,0);
  assert.deepEqual(await gateway.execute({code:"x"},context),{ok:false,error:"job_execution_in_progress"});
});

test("admission quarantine is scoped; unrelated jobs continue and denied policy permits retry", async () => {
  let runs=0;
  let deny=true;
  const gateway=createGizeCodeMode({
    executionTimeoutMs:25,
    runner:{kind:"isolated_worker",run:async()=>{runs++;return "done";}},
    authorize:({context})=>context.jobId==="blocked001" ? new Promise(()=>{}) :
      {allow:context.jobId!=="retry001" || !deny},
    invoke:async()=>null
  });
  const base={tenantId:"tenant1",principalId:"user001",jobId:"blocked001"};
  assert.equal((await gateway.execute({code:"x"},base)).error,"execution_timeout");
  assert.equal((await gateway.execute({code:"x"},base)).error,"job_execution_in_progress");
  assert.equal((await gateway.execute({code:"x"},{...base,jobId:"other001"})).ok,true);
  const retry={...base,jobId:"retry001"};
  assert.equal((await gateway.execute({code:"x"},retry)).error,"code_execution_not_authorized");
  deny=false;
  assert.equal((await gateway.execute({code:"x"},retry)).ok,true);
  assert.equal(runs,2);
});
