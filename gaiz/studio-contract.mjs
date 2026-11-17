// Governed Studio boundary: imported contracts are descriptors, not commands.
// Intentionally no IO, dynamic imports, activation, or executable dispatch.
export const STUDIO_CONTRACT_VERSION = 1;
const validId = s => typeof s === 'string' && /^[a-zA-Z][a-zA-Z0-9._-]{0,99}$/.test(s);
export function inspectStudioStepContract(input, allowedCapabilities = []) {
  const errors = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { valid: false, errors: ['INVALID_CONTRACT'] };
  if (input.contractVersion !== STUDIO_CONTRACT_VERSION) errors.push('UNSUPPORTED_VERSION');
  if (!validId(input.contractId)) errors.push('INVALID_ID');
  if (!validId(input.capability)) errors.push('INVALID_CAPABILITY');
  if (!allowedCapabilities.includes(input.capability)) errors.push('CAPABILITY_NOT_ALLOWED');
  if (!Array.isArray(input.requiredPermissions) || input.requiredPermissions.some(x => !validId(x))) errors.push('INVALID_PERMISSIONS');
  if (!input.inputSchema || typeof input.inputSchema !== 'object' || Array.isArray(input.inputSchema)) errors.push('INVALID_INPUT_SCHEMA');
  if (!input.outputSchema || typeof input.outputSchema !== 'object' || Array.isArray(input.outputSchema)) errors.push('INVALID_OUTPUT_SCHEMA');
  if ('code' in input || 'script' in input || 'url' in input || 'credentials' in input || 'autoActivate' in input)
    errors.push('ACTIVE_PAYLOAD_FORBIDDEN');
  return { valid: errors.length === 0, errors };
}
/** An import never activates a step, regardless of the supplied serialized state. */
export function quarantineStudioImport(input, allowedCapabilities = []) {
  const assessment = inspectStudioStepContract(input, allowedCapabilities);
  return Object.freeze({
    status: 'quarantined', executable: false, permissionsGranted: [],
    integrationsEnabled: [], validation: assessment,
    requiresHumanAuthorization: true,
  });
}
/** AI output is always a draft and never an execution grant. */
export function normalizeGizeProposal(proposal) {
  return Object.freeze({
    status: 'draft', executable: false, approved: false,
    definition: proposal && typeof proposal === 'object' && !Array.isArray(proposal)
      ? structuredClone(proposal) : null,
  });
}
