import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const script=readFileSync(new URL('../.github/workflows/retire-integrated-branches.yml',import.meta.url),'utf8');

test('branch retirement is limited to the intended repository and main ref',()=>{
  assert.match(script,/github\.repository == 'faisalwrokksa-hub\/TO'/);
  assert.match(script,/github\.ref == 'refs\/heads\/main'/);
  assert.match(script,/branch\.name === 'main' \|\| branch\.protected/);
});

test('retirement requires proven inclusion, no open PR, and unchanged branch head',()=>{
  assert.match(script,/compare\.data\.ahead_by === 0/);
  assert.match(script,/pr\.merged_at/);
  assert.match(script,/pr\.base\.ref !== 'main'/);
  assert.match(script,/pr\.head\.sha !== branch\.commit\.sha/);
  assert.match(script,/included\.data\.ahead_by === 0/);
  assert.match(script,/state: 'open'/);
  assert.match(script,/prs\.data\.length/);
  assert.match(script,/fresh\.data\.commit\.sha !== branch\.commit\.sha/);
  assert.match(script,/github\.rest\.git\.deleteRef/);
});

test('retirement remains serialized and reports failures',()=>{
  assert.match(script,/cancel-in-progress: false/);
  assert.match(script,/contents: write/);
  assert.match(script,/core\.setFailed/);
});

test('divergent branches may retire only on identical file blobs pinned to main',()=>{
  assert.match(script,/const mainSha = base\.data\.commit\.sha/);
  assert.match(script,/base: mainSha, head: branch\.commit\.sha/);
  assert.match(script,/files\.length >= 300/);
  assert.match(script,/\['added','modified','removed'\]/);
  assert.match(script,/mainFile\.sha !== branchFile\.sha/);
  assert.match(script,/file\.status === 'removed'/);
  assert.match(script,/!mainFile\.missing \|\| !branchFile\.missing/);
  assert.match(script,/error\.status === 404/);
  assert.match(script,/all branch-changed file blobs identical to main/);
  assert.match(script,/fresh\.data\.commit\.sha !== branch\.commit\.sha/);
});
