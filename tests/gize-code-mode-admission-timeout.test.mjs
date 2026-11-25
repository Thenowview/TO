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
