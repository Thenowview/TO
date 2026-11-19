# AO — GIZE implementation accelerator

**Status:** candidate engineering handoff, not production integration.

The user-provided full source ZIP (`agent-one-main.zip`) was inspected locally: 840 entries, 18,065,211 uncompressed bytes. A **curated AO-GIZE-implementation-kit.zip** was built in the conversation containing 16 *unaltered* upstream reference files, three independent JSON schemas, one fail-closed policy prototype, 13 passing local Node tests, and OT/TEBE/TEFE/master handoffs. The binary ZIP remains a conversation artifact, not a GitHub binary or release.

## Implementation order
1. OT: review existing `apps/chrome-extension`, signed native bridge and GIZE crypto; integrate *capability discovery only* behind a disabled flag, then implement limited tool dispatch with allowlisted origins and bounded processes.
2. TEBE: own server identity, tenant authorization, entitlement, workflow approval, MCP credentials and immutable audit. Agree on contract versions with OT before any live call.
3. TEFE: document only verified features across declared locales; no runtime/vendor files in marketing builds.
4. MASTER: reconcile all changes with original 150 IDs without renumbering; require exact SHA, CI, security review, customer E2E and live deployment readback.

## Files
- `contracts/ao-tool.schema.json`: minimal tool registry contract
- `contracts/ao-task.schema.json`: task envelope
- `contracts/ao-approval.schema.json`: explicit approval decision
- `src/ao-policy.mjs`: independently drafted deny-first *prototype*; **not** a replacement for server-side authorization
- `tests/ao-policy.test.mjs`: no-dependency Node tests
- `docs/ao-accelerator/EXPERTS.md`: per-owner implementation handoff

## Legal and release boundaries
Original upstream source is AGPL-3.0; preserve its license and attribution. The reported additional permission has not been independently documented or evaluated. **AO** is GIZE's internal integration name, not a way to remove upstream license/copyright notices. The upstream reference-only source is in OT PR #78, separate from runtime; this PR does not copy upstream code. Do not execute the uploaded Windows installer or embed unreviewed dependencies. Preserve `.gize`, legacy `.gaiz`, GAIZ1/GAIZ2 wire identifiers, tenant controls and production NO_GO.
