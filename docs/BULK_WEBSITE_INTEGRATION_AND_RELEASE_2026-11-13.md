# TheOrg — bulk website integration and release gates (13 Nov 2026)

## Scope

Source-only improvements to the existing local TheOrg dashboard, Adaptive 1/2/3 architecture, portable Windows acceptance and Android Nano source verification. No production deployment, main-branch merge, model download, external API call, device-level installation or autonomous source edit is performed by this batch.

## Website check and proposed integrations

**TheOrg web interface** lives at `offline_desktop/static` and is served by an authenticated localhost Python API. It is NOT an independently verified public website. The new Settings / Website integrations panel uses `GET /api/website/integrations`, which is authenticated and read-only. Each candidate is explicitly unverified until its own connection approval is completed. No localhost bearer token is passed to a web host.

Candidate | Support level | Boundary
---|---|---
Local web UI | Already present | First-party localhost API; never deploy it openly
GitHub | Existing operator/source tools | Exact repo, branch, run, approval required for any writes
Google Workspace | Existing read-only source sketches | Explicit OAuth/scopes, no implicit account access
Cloudflare | Future static public pages only | Needs account, independent deployment and DNS approval; never proxy local API
**theorg.com** (unrelated provider) | Future optional business/org chart research | API/MCP keys and credit/licensing verification; no automatic paid use

The **theorg.com** data service is a *separate business* and is not the user's TheOrg project. Sources: https://developers.theorg.com/, https://developers.theorg.com/api, https://developers.theorg.com/mcp. Do not assume its paid endpoints are free or connected. The current project GitHub repository has no independently confirmed public website deployment URL.

## Commands and actual meaning

Run from `offline_desktop` (Python and Node must already be available):

```shell
python scripts/run_bulk_source_checks.py --report /safe/local/path/source-checks.json
```

On Windows, double-click `RUN-BULK-SOURCE-CHECKS.cmd` to write a source receipt to `%TEMP%`. **This is source verification, not a Windows install.** Android source-only security contract: `python scripts/android_source_contract.py`. No SDK or network needed.

On a trusted Windows build machine only, `Build-TheOrg-Portable-Windows.ps1` can produce a portable EXE candidate after pinned downloads and actual EXE self-test, localhost HTTP, token auth, bundled Git/llama-server presence, Git project, and desktop shortcut checks. Now writes `WINDOWS-SMOKE.json` with the *exact EXE SHA-256* and validates it with `scripts/check_release.py`. The receipt must never be written after a failed smoke step. The build is not runnable on Linux, and script parsing/runtime are unverified here.

Android Nano source lives under `offline_desktop/android-nano`. A configured Android SDK+Gradle/JDK environment and real-device install/functional acceptance are still required. Source contract checks are not an APK build.

## Adaptive model readiness

- Adaptive 1: model-free; offline local tools and stored reviewed knowledge.
- Adaptive 2: recommended when an actual small installed GGUF and compatible `llama-server` runtime can fit physical available RAM. A successful real generation probe remains required.
- Adaptive 3: candidate larger GGUF where actual hardware supports it; no mandatory use or auto download.
- Do not promise that a checked GGUF header means successful token generation, or that free system RAM equals GPU VRAM.

The model manager (`scripts/adaptive_model_manager.py`) requires an explicit download action, verifies expected SHA-256 and disk space, and does not run during startup. The integrated operating desk exposes counts and read-only routing preview; it never grants tool authorization. Knowledge imports enter the candidate review queue and cannot inherit the verified flag.

## Completion boundary

Locally testable: Python and JavaScript suites, local HTTP authentication and catalog, the Android source contract, source archive integrity, package/EXE receipt logic (source only), and local engine self-test. **Still unresolved:** pinned-runtime actual Windows build, clean-machine EXE acceptance, real GGUF performance and memory, Android APK/physical device, end-to-end agent execution/sandbox tests, and independent provider permission checks. These are production NO-GO requirements; source tests cannot replace them.
