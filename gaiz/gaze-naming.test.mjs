import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=(p)=>readFileSync(new URL(p,import.meta.url),'utf8');
test('.GAZE is the official name, GAIZ identifiers are legacy compatibility only',()=>{
 const doc=read('./README.md');
 assert.match(doc,/^# \.GAZE/m);
 assert.match(doc,/Official customer-facing name: `\.GAZE`/);
 assert.match(doc,/legacy experimental identifiers/);
 assert.match(doc,/Do not rename encrypted bytes/);
 assert.match(doc,/no silent conversion/i);
});
test('legacy cryptographic wire bytes are explicitly versioned, not silently renamed',()=>{
 const v1=read('./core.mjs');
 const v2=read('./v2.mjs');
 assert.match(v1,/GAIZ1/);
 assert.match(v2,/GAIZ2/);
 assert.doesNotMatch(v1,/GAZE1/);
 assert.doesNotMatch(v2,/GAZE2/);
});
