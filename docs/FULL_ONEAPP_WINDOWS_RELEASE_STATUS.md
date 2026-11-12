# TheOrg Full OneApp — release candidate status

Date: 2026-11-12. Branch: `feat/full-oneapp-windows-release-20261112`. Draft PR: https://github.com/faisalwrokksa-hub/TO/pull/22.

## Target

One `START THEORG.cmd` / desktop shortcut launches a PyInstaller-bundled `TheOrg.exe` (Python included), a self-contained `TheOrg.Bridge.exe` (.NET included), the named-agent Chrome Supervisor, and a local AI dashboard. A Chrome-for-Testing archive and a licensed GGUF model archive are optional explicit builder inputs.

## Components

| Component | Target | Verification |
|---|---|---|
| Offline Python engine | PyInstaller `TheOrg.exe`, pinned llama.cpp and MinGit | Windows build unverified |
| Supervisor + company agents + four-agent job queue | Keyed Chrome extension | Source tests previously reported; no real browser E2E |
| Native Messaging bridge | `dotnet publish ... --self-contained true` | Windows build unverified |
| One launcher | `tools/Start-TheOrg-Full.ps1` + generated `START THEORG.cmd` | Windows launch unverified |
| Browser | Optional SHA-256 verified archive, else installed Chrome | Supplied archive not independently verified |
| GGUF | Model ZIP copied only after explicit rights confirmation | License/provenance and actual inference unverified |
| Automated AI handoff | Scoped ChatGPT/Claude content script | Live provider E2E unverified |

## Build status

The `TheOrg Full OneApp Windows (review-only)` GitHub Actions run https://github.com/faisalwrokksa-hub/TO/actions/runs/43189182313 failed. Its job reported **zero executed steps** and no published artifacts, so the current root cause is undetermined. No `TheOrg.exe` or self-contained bridge can be attested from this attempt. The repo has not been merged or deployed.

## Source and binary inputs

- Latest branch contains `offline_desktop`, `engine/bridge`, `apps/chrome-extension`, current tests and release build scripts.
- Portable Python ZIP in Drive: https://drive.google.com/file/d/1YC0BUVNMJeDnmdtYgiWnEH3NvXfV5ET5/view. The Windows builder uses PyInstaller's embedded interpreter and does not need to copy this ZIP into the final binary.
- Chrome ZIP in Drive: https://drive.google.com/file/d/1hmUuRcu3OlL0vup_E4sPLanusGt1MiG9/view. Requires independent provenance and checksum verification before bundling.
- GGUF archive in Drive: https://drive.google.com/file/d/14kb2EXL0MfChMFjHBTdMytk2FUgVFbyt/view. Do not redistribute or activate before confirming rights, model provenance, compatible llama.cpp runtime and capacity.
- Previous source-and-builder package in Drive: https://drive.google.com/file/d/1x0S0cbNibfIrcdcMBXhAgYYfPVghYvjq/view. It is not the completed standalone Windows release.

## Remaining acceptance gates

1. Resolve GitHub Windows job startup failure or use a licensed, verified local Windows build host.
2. Run engine, bridge, and source tests and capture actual logs.
3. Produce and checksum the unsigned candidate ZIP; inspect final manifest and binaries.
4. Run first-use test on fresh Windows 10/11 x64 PC **without Python and .NET installed**.
5. Test agent queue (four active maximum), browser provider sign-in and response capture, persistence and company isolation.
6. Import an approved GGUF ZIP and verify **actual** local inference; do not infer success from file existence.
7. Preserve owner approval for external sends, modifications, deployment, and model license attestation.

This is a review-only engineering handoff, **not** a certification that the full package works.
