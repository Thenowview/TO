# OT Windows validation — 21 November 2026, Riyadh

Execution occurred on 20 November UTC. Customer release remains NO_GO; this
records scoped executable and offline cryptography tests, not full UI acceptance.

## Merged runtime and exact tested artifact

Reviewed-plan binding PR #111 is merged as
`63691056c965e0479ac8ebc08dcea8a9294ce280`. All four workflows passed for candidate
`87ee0e9cb75dfd97090f90a374d168a98af8a156` before merge.

Windows bridge CI: https://github.com/faisalwrokksa-hub/TO/actions/runs/44825339462
Artifact: `TheOrg-Windows-bridge-unsigned-candidate`, ID `14673033818`.
ZIP integrity checked before extraction. Executable SHA-256:
`6719B46FE57DA79ED713D985E8AA3DD14F52BAC1A4B31ECE8A0A576A80F43C34`.
Authenticode status: `NotSigned`.

Both actual Windows executable stdio suites passed on the owner's PC:

- `tests/native-messaging-smoke.py`: persisted synthetic work order, artifact
  import/hash/read, company isolation and format-only `.gize` / `.gaiz` intake.
- `tests/ao-native-agent-smoke.py`: approval, missing/stale review fingerprint
  rejection, safe local batch, fresh-process recovery and browser/cancellation gates.
  Browser gates here are protocol tests, not actual Chrome UI acceptance.

The 38 local JS tests passed for review binding, task manager, UI contracts and
extension permissions. GitHub Windows self-tests and installer install/uninstall
checks also passed. No independent review approval was recorded before merge.

## Offline encryption and compatibility

Source revision tested: `63691056c965e0479ac8ebc08dcea8a9294ce280`, with only the
CLI test's Windows file-URL path corrected. Runtime encryption source is unchanged.
Local runtime: Node `v24.22.1`, Python `3.12.10`.

All 17 tests passed:
`gaiz/cli-extension.test.mjs`, `gaiz/file-extension.test.mjs`,
`gaiz/gize-acceptance.test.mjs`, `gaiz/test.mjs`, `gaiz/v2.test.mjs`.

These exercised actual synthetic-key GAIZ1/GAIZ2 round trips, canonical `.gize`
export and legacy `.gaiz` verify/open, signed fixed fixtures, tampering, wrong
tenant/issuer/key, malformed and noncanonical input, explicit legacy-export opt-in
and refusal to overwrite existing outputs. No real customer key, provider call,
enterprise login or paid service was used. This is not live KMS/revocation or
physical Windows application/Chrome decryption acceptance.

The CLI test previously used `URL.pathname` with `path.resolve`, producing a
`C:\C:\...` path on Windows. `fileURLToPath` fixes the test launcher. Windows CI
now runs the focused offline suite with pinned Node 22 as well.

## Remaining device and release limits

- Physical Chrome extension/native-host connectivity is NOT VERIFIED. Computer
  Use stopped when it could not determine Chrome's current URL sufficiently to
  enforce policy. No alternate access path was used to bypass that decision.
- The legacy Workspace 2 portable program removal is PARTIAL: Windows recycled
  three program entries, then reported Folder In Use. The remaining program
  directory still exists. Task Manager has higher integrity than the controller;
  the locking process was not terminated. The separate local
  `TheOrgWorkspaceV2/data` directory was preserved and still exists.
- Complete removal only after the exact legacy app process using the executable
  under `Programs/TheOrgWorkspaceV2/runtime` has closed. Do not terminate unrelated
  Node processes or delete the separate user-data directory.
- Trusted release signing remains unavailable. Do not substitute a fabricated or
  self-signed identity for trusted signing, or call an unsigned artifact signed.
- Test the actual installed reviewed build in Chrome Stable, record extension ID,
  executable hash and registered host origin, perform a real workflow/restart and
  an authorized encrypted-file round trip before accepting the release.

This evidence supplements `OT-PC-ACCEPTANCE-20261120.md`; earlier blocked/historical
observations are retained. No whole source requirement is marked VERIFIED here.
