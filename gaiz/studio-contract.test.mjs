import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectStudioStepContract, quarantineStudioImport, normalizeGizeProposal } from './studio-contract.mjs';
const proposal = { contractVersion: 1, contractId: 'project.change', capability: 'evidence.write',
  requiredPermissions: ['evidence.create'], inputSchema: {type:'object'}, outputSchema: {type:'object'} };
test('versioned allow-listed contract validates', () => {
  assert.equal(inspectStudioStepContract(proposal, ['evidence.write']).valid, true);
  assert.equal(inspectStudioStepContract(proposal, []).valid, false);
});
test('imports cannot grant permissions or activate execution', () => {
  const result = quarantineStudioImport({...proposal, autoActivate: true}, ['evidence.write']);
  assert.equal(result.executable, false);
  assert.equal(result.status, 'quarantined');
  assert.deepEqual(result.permissionsGranted, []);
  assert.ok(result.validation.errors.includes('ACTIVE_PAYLOAD_FORBIDDEN'));
});
test('GIZE AI proposals remain drafts', () => {
  const result = normalizeGizeProposal({ workflow: { published: true } });
  assert.equal(result.status, 'draft');
  assert.equal(result.approved, false);
  assert.equal(result.executable, false);
});
