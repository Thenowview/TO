// Filename policy is UX/compatibility metadata, never a substitute for
// cryptographic header verification or tenant authorization.
import { basename } from 'node:path';

const MAX_NAME_LENGTH = 255;
const VALID_EXTENSIONS = new Set(['.gize', '.gaiz']);

/** Report a file's extension without reading, decoding or trusting its contents. */
export function classifyArtifactFilename(filename) {
  if (typeof filename !== 'string' || filename.length === 0 || filename.length > 4096 ||
      filename.includes('\0')) throw new TypeError('Invalid artifact filename');
  const name = basename(filename);
  if (!name || name === '.' || name === '..' || name.length > MAX_NAME_LENGTH ||
      /[\\/]/.test(name)) throw new TypeError('Invalid artifact basename');
  const extension = name.endsWith('.gize') ? '.gize' :
                    name.endsWith('.gaiz') ? '.gaiz' : null;
  return Object.freeze({ extension, supported: VALID_EXTENSIONS.has(extension),
    legacyExtension: extension === '.gaiz',
    canonicalExtension: extension === '.gize' });
}

/** New exports use .gize. Legacy .gaiz exports require conscious opt-in. */
export function assertNewExportFilename(filename, { allowLegacy = false } = {}) {
  const result = classifyArtifactFilename(filename);
  if (result.canonicalExtension || (allowLegacy && result.legacyExtension)) return result;
  throw new Error('New GIZE exports require a lowercase .gize filename');
}

/** Deterministic portable default; never use an untrusted ID as a path. */
export function defaultGizeExportFilename(artifactId) {
  if (typeof artifactId !== 'string' || !artifactId.length || artifactId.length > 160)
    throw new TypeError('Invalid artifact ID for export filename');
  const safe = artifactId.replace(/[^A-Za-z0-9._-]/g, '_').replace(/^\.+/, '_');
  const filename = 'gize-' + safe + '.gize';
  assertNewExportFilename(filename);
  return filename;
}
