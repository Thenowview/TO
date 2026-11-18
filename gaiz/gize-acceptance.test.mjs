import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {verifyGaiz2} from './v2.mjs';
import {classifyArtifactFilename, assertNewExportFilename} from './file-extension.mjs';

const fixtureDir = fileURLToPath(new URL('./fixtures/v2-fixed-001/', import.meta.url));
const expected = JSON.parse(readFileSync(join(fixtureDir, 'expected.json'), 'utf8'));
const bytes = Buffer.from(readFileSync(join(fixtureDir, 'valid.gaiz.b64'), 'utf8').trim(), 'base64');
const policy = {
  trustedIssuerPublicKey: readFileSync(join(fixtureDir, 'issuer-public.pem'), 'utf8'),
  expectedIssuerId: expected.manifest.issuerId,
  expectedTenantScope: expected.manifest.tenantScope
};

test('canonical .gize extension does not rewrite or reinterpret signed GAIZ2 wire bytes', () => {
  assertNewExportFilename('synthetic-report.gize');
  assert.deepEqual(bytes.subarray(0, 6), Buffer.from([0x47,0x41,0x49,0x5a,0x32,0x0a]));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), expected.sha256);
  const verified = verifyGaiz2(bytes, policy);
  assert.equal(verified.receipt.sha256, expected.sha256);
  assert.equal(verified.receipt.signatureVerified, true);
  assert.equal(verified.receipt.authorizationGranted, false);
  assert.equal(verified.receipt.importAllowed, false);
});

test('legacy .gaiz and canonical .gize file names do not affect cryptographic trust policy', () => {
  for (const filename of ['synthetic-report.gaiz', 'synthetic-report.gize']) {
    assert.equal(classifyArtifactFilename(filename).supported, true);
    assert.throws(() => verifyGaiz2(bytes, {...policy, expectedTenantScope:'wrong-tenant'}), /Tenant denied/);
    assert.throws(() => verifyGaiz2(bytes, {...policy, expectedIssuerId:'wrong-issuer'}), /Issuer denied/);
  }
});

test('renaming damaged or forged bytes to .gize cannot create a valid envelope', () => {
  assertNewExportFilename('forged.gize');
  const damaged = Buffer.from(bytes);
  damaged[0] ^= 0x01;
  assert.throws(() => verifyGaiz2(damaged, policy), /header/);
  const altered = Buffer.from(bytes);
  altered[altered.length - 1] ^= 0x01;
  assert.throws(() => verifyGaiz2(altered, policy));
});
