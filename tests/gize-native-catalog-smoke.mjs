// Actual published native host integration; no model execution or external operations.
import assert from "node:assert/strict";
import {spawnSync} from "node:child_process";
import {resolve} from "node:path";
import {describeNativeTools} from "../code-mode/native-catalog.mjs";
const binary=process.argv[2];
assert.ok(binary,"native binary path required");
const payload=Buffer.from(JSON.stringify({command:"agent_tools"}));
const header=Buffer.alloc(4);header.writeUInt32LE(payload.length);
const result=spawnSync(resolve(binary),[],{input:Buffer.concat([header,payload]),timeout:45000,maxBuffer:1024*1024});
assert.ifError(result.error);assert.equal(result.status,0,"native process failed");
const output=result.stdout;
assert.ok(output.length>=4,"missing native frame");
const size=output.readUInt32LE(0);
assert.ok(size>0 && size<=1024*1024 && output.length===size+4,"invalid or extra native frames");
const receipt=JSON.parse(output.subarray(4).toString("utf8"));
assert.equal(describeNativeTools(receipt).ok,true,"actual native descriptor contract rejected");
for(const patch of [{mcpEnabled:true},{remoteToolExecutionEnabled:true}]){
 const denied=describeNativeTools({...receipt,...patch});
 assert.equal(denied.ok,false);assert.deepEqual(denied.tools,[]);
}
console.log("Actual native framed catalog accepted; MCP activation claims denied; execution remains disabled.");
