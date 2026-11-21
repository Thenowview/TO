# Windows PC bridge acceptance — 21 November 2026

## Tested subject
- Source commit: f8005a292d655f8dc47edf58d83cbff7bfe1074c
- CI workflow: https://github.com/faisalwrokksa-hub/TO/actions/runs/44936893412
- Downloaded artifact: TheOrg-Windows-bridge-unsigned-candidate, ID 14719829064
- TheOrg.Bridge.exe SHA-256: bd26dd29500171105d2d6441684c0980530ec91841c03eb75f71c0f49f2b0285
- Authenticode result on owner PC: NotSigned. This is development-build testing, not trusted release acceptance.
- Tests fetched from the same source commit.

## Observed local results
1. `tests/native-messaging-smoke.py`: PASS. Actual Windows executable, length-prefixed stdio frames, persisted work order, file import/format check/readback and company isolation.
2. `tests/ao-native-agent-smoke.py`: PASS. Persisted agent order, artifact review, company isolation, reviewed-plan approval checks, safe batch, process restart, browser-action approval/cancellation gates. Browser gates are protocol checks; no interactive browser acceptance is inferred.
3. `TheOrg.Bridge.exe --self-test`: FAIL/incomplete on this PC. Windows denied CreateSymbolicLink with a required-privilege error at Program.cs:957. No elevation, execution-policy change or security exception was applied. Exact-commit Windows CI had passed, but that does not override the local limitation.

The first agent-suite attempt redirected LOCALAPPDATA for Python; the .NET host resolves the Windows known folder independently. Python could not open its expected database. Rerunning with the normal matching paths passed. The initial basic protocol test also passed, and it was rerun successfully with normal paths. The first mismatched run may have left its randomly named synthetic company data in the Windows known-folder workspace because its Python cleanup looked in the redirected directory; no broad cleanup or deletion of unrelated companies was attempted.

## Limits
The bridge was launched directly by Python on the owner's PC, not through Chrome. These results do not establish extension installation, native-host registration visibility, physical Chrome UI roundtrip, Store/MSIX behavior, full offline-model operation, signing, malware clearance, or production readiness. No existing app was replaced or installed by this test.

Next acceptance: real extension connection and artifact roundtrip in Chrome, then install/restart/update/uninstall checks for the chosen distribution package. Public signing remains deferred under the owner's proprietary-license decision.
