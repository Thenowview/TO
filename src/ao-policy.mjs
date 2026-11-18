// Independent AO policy prototype, not a production authorization service.
// The TEBE API must independently enforce verified principals, tenants, entitlements and approvals.
export function decideAO({tool,identity,approval,request}={}) {
  if (!tool?.enabled || !identity?.authenticated || !identity?.principalId || !identity?.tenantId)
    return {verdict:"DENY",reason:"disabled_or_unauthenticated"};
  if (!identity.entitled || !identity.tenantAuthorized || !identity.allowedToolIds?.includes(tool.id))
    return {verdict:"DENY",reason:"unauthorized_tool"};
  if (!["read","reversible_write","external_write","privileged"].includes(tool.risk))
    return {verdict:"DENY",reason:"unknown_risk"};
  if (!["native","mcp_stdio","mcp_http","tebe_api"].includes(tool.transport))
    return {verdict:"DENY",reason:"unknown_transport"};
  if (tool.transport==="mcp_stdio" && !identity.approvedNativeHost)
    return {verdict:"DENY",reason:"unapproved_native_host"};
  if (tool.transport==="mcp_http" &&
      (!identity.endpoint?.startsWith("https://") || !identity.allowedMcpEndpoints?.includes(identity.endpoint)))
    return {verdict:"DENY",reason:"unapproved_endpoint"};
  if (tool.risk==="external_write" || tool.risk==="privileged")
    return approval?.verifiedForRequest === true && approval?.approvedByHuman === true &&
      typeof request?.requestId === "string" && request.requestId.length >= 8 &&
      approval.requestId === request.requestId && approval.toolId === tool.id &&
      approval.tenantId === identity.tenantId && approval.principalId === identity.principalId
      ? {verdict:"ALLOW",reason:"verified_human_approval"}
      : {verdict:"ASK",reason:"human_approval_required"};
  if (tool.risk==="reversible_write" && !identity.routineWriteAllowed)
    return {verdict:"ASK",reason:"write_approval_required"};
  return {verdict:"ALLOW",reason:"policy_allow"};
}
