import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { Script } from 'node:vm';
const source=readFileSync(new URL('./dist/worker.mjs',import.meta.url),'utf8');
new Script(source.replace('export default {','const worker = {'),{filename:'worker.mjs'});
for(const literal of [
 "connected_agent_runtime: false", "epmo_connected: false",
 "connect-src 'none'", "frame-ancestors 'none'", "x-content-type-options",
 "/api/health", "/operations", "/assets/operations-analytics.mjs",
 "/assets/report-engine.mjs", "script-src 'self'"
])assert.ok(source.includes(literal),'Missing Worker contract '+literal);
assert.ok(source.includes("url.pathname === '/'"),'Worker homepage route missing');
assert.ok(source.includes("request.method!=='GET'&&request.method!=='HEAD'"),'Only safe HTTP methods allowed');
assert.doesNotMatch(source,/https?:\/\/[^\s"']+theepmo\.com/i);
console.log('Standalone multi-route Worker contract: PASS');
