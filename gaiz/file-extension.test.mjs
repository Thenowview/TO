import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyArtifactFilename, assertNewExportFilename } from './file-extension.mjs';

test('new exports accept canonical lowercase .gize', () => {
  const result = assertNewExportFilename('customer-report.gize');
  assert.equal(result.canonicalExtension, true);
  assert.equal(result.legacyExtension, false);
});

test('legacy .gaiz filenames remain detectable and explicitly opt-in for new exports', () => {
  const result = classifyArtifactFilename('historical.gaiz');
  assert.equal(result.legacyExtension, true);
  assert.equal(result.supported, true);
  assert.throws(() => assertNewExportFilename('historical.gaiz'), /lowercase \.gize/);
  assert.equal(assertNewExportFilename('historical.gaiz', {allowLegacy: true}).legacyExtension, true);
});

test('unsupported and deceptive extensions cannot be exported', () => {
  for (const name of ['report.gize.exe', 'report.GIZE', 'report', 'report.gaiz.bak',
                       '', 'report.gize\0.bat']) {
    assert.throws(() => assertNewExportFilename(name));
  }
});

test('file extension never reports a cryptographic verification result', () => {
  const result = classifyArtifactFilename('anything.gize');
  assert.deepEqual(Object.keys(result).sort(), ['canonicalExtension', 'extension', 'legacyExtension', 'supported'].sort());
  assert.equal(Object.hasOwn(result, 'signatureVerified'), false);
  assert.equal(Object.hasOwn(result, 'authorizationGranted'), false);
});
