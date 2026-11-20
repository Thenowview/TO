# OT current-build PC validation — 2026-11-20 UTC

Decision: NO_GO for customer release. This records observed results, not a full
physical Chrome/Windows acceptance sign-off.

## Build provenance

- Main source: `fba5b4b07c5d7dd5f8074856c03b488ad44a0895`.
- Successful Windows build: https://github.com/faisalwrokksa-hub/TO/actions/runs/44809855005
- Artifact: `TheOrg-Windows-bridge-unsigned-candidate`, ID `14664494407`.
- Executable SHA-256: `D3A022B0EB81A879D78324C1864655DCAD955F908023AC1CEA0BE7AD50A46766`.
- ZIP CRC validation passed; Authenticode reports `NotSigned`.
- No current-user code-signing certificate was returned by the local certificate
  inventory. No signing identity or private key was created/exported.

## Observed results on the owner's Windows PC

| Check | Result | Meaning |
| --- | --- | --- |
| Published executable, real length-prefixed Native Messaging stdio | PASS | Ping, persisted synthetic order, artifact import/hash/read and company isolation passed |
| Native agent smoke (synthetic approval/batch/recovery) | PASS | Real executable with persisted synthetic job state; no real AI/provider claim |
| `.gize` and legacy `.gaiz` intake | PASS, format only | Does not prove signature verification or decryption authorization |
| Full `--self-test` | BLOCKED / exit 1 | Windows refused symbolic-link creation: required privilege not held; no protection bypassed |
| Chrome Stable extension to registered native host | NOT VERIFIED | Stdio tests do not prove browser registration or UI connectivity |
| Offline local-model inference | NOT VERIFIED | Synthetic plans are not model acceptance |
| Authenticode signing | NOT SIGNED | Remains a release gate |
| Superseded TheOrg Workspace 2 removal | BLOCKED | Portable app retirement encountered Access Denied; original directory still exists |

The superseded app stores user data separately under the local
`TheOrgWorkspaceV2` state directory. No user-data deletion was requested or
performed. A retirement destination may contain partial copied/moved program
entries; do not delete either copy without reconciling its contents.

The earlier Edge-rendered legacy workspace observations are excluded from this
build's acceptance. UI automation could not activate the minimized Explorer
window. The earlier localhost browser access denial was not bypassed.

## Required next evidence

Use the exact reviewed candidate after code changes pass CI. Record Chrome Stable
version, extension ID, installed executable hash, native-host origin restriction,
connection result, actual synthetic workflow/delivery and recovery after restart.
Then record authenticated encrypted round trips, wrong-key/tamper rejection,
legacy compatibility and authorized offline behavior. Resolve the symbolic-link
test environment through an authorized test machine without disabling security.
Sign with the owner's trusted code-signing service/certificate and independently
validate the resulting binary. Keep issue #71 open until all release gates pass.
