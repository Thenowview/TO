# Task completion and quick-start repair — 22 November 2026

## Problem and behavior

The Supervisor could reach manual_qa_recorded_owner_confirmation_pending but
offered no action to record owner acceptance. Every review left the phase at
awaiting_supervisor_review, so even fully reviewed deliveries could never finish.

The new Accept delivery & finish action requires submitted specialist handoffs,
passing current acceptance criteria, at least one valid delivered file, an exact
reviewed snapshot and an explicit owner acceptance note. File bytes are verified
again before acceptance. Owner acceptance is recorded as completed_owner_accepted;
identity and semantic correctness remain explicitly not independently certified.
A later plan, handoff or QA change reopens the order and retains acceptance history.
A review racing with an order change fails instead of overwriting the newer state.

## Quicker task entry

The start screen offers Research, Create a file, and Code & troubleshoot.
Category clicks change the instruction hint rather than submitting generic
instructions or erasing an existing draft. AI providers and plan editing are
collapsed optional controls. Copy prompt & open adviser copies the task prompt
before opening the provider tab. Website pasting and sending remain manual.
No extension permissions, host access, CSP or provider automation were added.

## Evidence and limits

The focused JavaScript behavior checks passed for positive completion, stable
rechecking, QA invalidation/history, missing delivery, failed file verification
and stale snapshot rejection. JavaScript syntax was checked. Full Node and
Windows installer CI must pass for the exact commit before release.

The PC execution environment disconnected during development. This change
cannot itself establish that the installed extension was updated, that the
Chrome interface was exercised, or that autonomous provider handoff works.
The optional local model and native-job semantic review remain separate from
owner acceptance of the browser work order.

The repository-local browser guidance was read. Its npm CLI was not run because
outbound package access and then the local execution environment were unavailable.
Existing MV3/CSP/least-privilege standards and contract/security tests are retained.
