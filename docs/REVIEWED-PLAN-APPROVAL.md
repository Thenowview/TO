# Approve the plan that was displayed

This candidate adopts Amuse's useful action-scoped review pattern within the
existing OT runtime. No Amuse server, credential vault, scheduler or provider is
installed. See the pinned source assessment in `vendor/amuse/GIZE-ADOPTION.md`.

## Native contract

`agent_get` returns `reviewFingerprint`, derived by the existing `plan-v1`
fingerprint over job ID, company, order, plan and approved hosts. This is content
identity, not an authentication credential or permission to run a tool.

`agent_approve` requires both `approved: true` and the exact `reviewFingerprint`
from the snapshot displayed to the owner. The host compares it to current state
before the existing atomic approval transition. A missing/stale fingerprint
leaves the job awaiting approval. Running still requires the native approval
event to match the current plan and scope.

Chrome retains the snapshot only for the currently selected order/job, ignores
late results after selection changes, and forwards only validated approval
fields. Caller extras cannot overwrite command, company or job IDs. Plan text
continues to render with `textContent`; CSP and extension privileges are unchanged.

## Upgrade behavior

The updated Chrome UI disables approval if an older host omits the fingerprint
and shows an update/refresh instruction. Old clients that omit it cannot approve
on the new host. Update Chrome extension and bridge together. Existing queued
jobs retain their unchanged native fingerprint format and approval checks. No
GAIZ1/GAIZ2 bytes, `.gize` / legacy `.gaiz` paths or encryption keys are changed.

## Validation and remaining device evidence

- 38 local Node tests passed across review binding, task manager, UI contracts and
  extension privilege boundaries. These use simulated Chrome, not physical E2E.
- Native self-test and framed executable smoke fixtures now reject a missing
  fingerprint and a scope changed between display and approval, then exercise a
  valid reviewed approval. Their compiled Windows results must come from this
  candidate's exact CI head; the earlier artifact does not prove this change.
- On the actual reviewed Chrome/Windows build: open a synthetic order, review a
  plan, approve it, complete a local-only task and restart. In two tabs, change
  scope after display and confirm the stale tab cannot approve. Confirm an old
  host cannot enable the approval button. Record build hash and extension ID.

Signing, physical Chrome/native registration and authorized encrypted round-trip
acceptance remain separate release gates. The PC's superseded Workspace 2 app and
the prior localhost access denial are not substitutes for these checks.
