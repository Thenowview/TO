# Master implementation prompt — Replace THE EPMO’s offline system with OT for Windows

## Assignment

Act as the lead engineer for OT, THE EPMO’s local-first Windows companion. Implement, test, and package a working replacement for the existing offline user experience. Deliver code, a migration that preserves existing work, an installable Windows candidate, verification evidence, and an operator rollback procedure. Use focused branches and reviewable pull requests. Follow the repository instructions. Obtain explicit release authorization before production merge, deployment, or making an installer public.

The replacement is complete when an existing offline user can upgrade, open an existing workspace, submit and monitor supported PC tasks while disconnected, verify the resulting artifacts, and reconnect to authorized enterprise jobs. A successful build alone does not satisfy that outcome.

## Source material and baseline

- OT desktop and local execution — [TO repository](https://github.com/faisalwrokksa-hub/TO).
- Enterprise application, tenant authorization, and online task APIs — [TEBE repository](https://github.com/2029TEBE/TEBE).
- Public site, desktop download entry, and existing customer artifact flows — [TEFE repository](https://github.com/2029TEFE/TEFE).
- Desktop audit and file-level design references — [Theepmo reference-to-OT technical handoff](https://chatgpt.com/library?file_id=libfile_c900b1cd56c88191948fbece1d30fbd5&account_id=personal). Open `Theepmo ref1.md`, then the migration matrix and task architecture. Treat packaged Electron behavior as a reference for responsive startup, views, and instrumentation. Implement within OT’s own interface and reuse its code and styles where appropriate. The audit did not establish how Theepmo reference’s hosted scheduler works or measure Windows latency.

The owner’s latest file-format decision overrides earlier extension proposals. **`.gize` is the canonical new filename extension for the existing `.gaiz` encrypted artifact format.** GAIZ1 and GAIZ2 bytes, version identifiers, signatures, and cryptographic behavior retain their existing meanings. Both filename extensions remain readable.

## 1. Audit and establish the replacement baseline

1. Record current default-branch commit SHAs and read repository guidance. Identify the version and installer users actually run, installation paths, launch shortcuts, data roots, configuration, schema versions, background process ownership, and update behavior. Check existing feature branches for reusable work.
2. Trace actual desktop startup, offline UI routes, task submission, execution, status updates, cancellation, local model behavior, and artifact handling. Start with `offline_desktop/app.py`, `offline_desktop/static/`, `offline_desktop/engine/`, `apps/chrome-extension/`, `engine/bridge/`, `portable/`, and `gaiz/`. Confirm paths and call sites on the pinned revision. Include relevant tests, workflows, and installer scripts.
3. Inventory user-facing features and existing data including workspaces, tasks, pending approvals, audit history, preferences, local model references, imported files, and encrypted artifacts. Produce a parity matrix with each feature’s source, replacement entry point, migration behavior, and verification.
4. Verify available TEBE and TEFE contract surfaces by reading code and tests. Record the precise endpoint and version when present. Where an external service or test environment is unavailable, implement and test against an explicit mock or contract fixture and report the live verification gap.
5. Build and test the baseline before changes. Record existing failures separately. Use synthetic fixtures and copies of representative legacy layouts. Track planned and actual changes by repository.

## 2. Build the Windows workspace

- Make the new workspace the default desktop launch experience after the upgrade gate passes. Reuse the existing local dashboard and native capabilities unless a measured or verified dependency justifies another host. Ensure the installed app opens without internet or an enterprise sign-in.
- Design a persistent workspace shell with **Workspaces**, **Tasks**, **Files**, and **Settings**. Include a task composer and detail view for plan, permissions, approvals, live events, and deliverables. Provide a clear connection indicator and show **On this PC** or **Online via THE EPMO** before submission. Acknowledge a local submit once the job is durably recorded and show the receipt.
- Use GIZE AI branding and consistent THE EPMO terminology. Support the existing locale registry, English fallback, Arabic RTL, keyboard navigation, readable contrast, visible focus, reduced motion, accessible announcements, and Windows display scaling. Preserve the selected workspace and task context where supported. Provide explicit empty, loading, offline, permission-denied, failure, and recovery states.
- Keep startup and navigation responsive during model inference and file handling. Load the shell and active task summary first. Run long operations away from the UI thread. Bound logs, batch progress updates, and paginate or virtualize large histories where profiling supports it.
- Use the OS launcher, windowing, and browser integration already supported by the product. Evaluate a thin native host only if Windows acceptance or measured responsiveness warrants it.

## 3. Implement supported PC task execution

- Trace the Python engine and Windows bridge capabilities, then expose them through stable local interfaces. Inventory supported file reading and report generation, local model inference, supported application launch, and configured project checks. Route every action to the backend that actually supports it. Keep manual provider handoffs explicit. Scope first release to reviewed capabilities.
- Convert an instruction into a structured plan that previews the action, workspace, input files, destination, and permission requirements. Validate and enforce that scope at dispatch. Require a fresh approval if an action or its scope changes. Use dedicated, bounded adapters for supported desktop applications. For example, a safe file-open operation can invoke an approved Windows app with a validated workspace path. Any deeper editing workflow requires its own application-specific adapter and tests.
- Constrain paths to authorized workspaces and handle Windows junctions, symlinks, path normalization, and revalidation before file operations. Apply resource limits and timeouts. Treat external files and AI output as untrusted input. Keep credentials out of UI storage, logs, reports, and Git. Protect loopback routes and the native bridge from unauthorized callers.
- Keep the core workspace, file handling, and supported deterministic jobs usable offline. Show optional AI capabilities only when a compatible local model is configured and passes a readiness check. Preserve existing isolated project-check behavior where supported by the installed environment.
- Keep connectors and delegated work within documented permitted capabilities. Show unsupported requests clearly and offer a manual handoff where one exists.

## 4. Unify the task experience and make it recoverable

- Introduce a shared task projection over existing authoritative stores first. Use backend-qualified durable IDs and preserve historical task, approval, and output references. Avoid copying live task ownership between stores during the initial rollout.
- Store a scoped client request ID, task ID, execution location, workspace, plan or approval revision, state revision, event position, and artifact references. Enforce idempotent submission. Make claim and state transitions consistent under concurrency. Acknowledge only after durable commit.
- Represent queued, waiting for connection, awaiting approval, running, verifying, completed, failed, interrupted, and canceled as explicit states. Distinguish cancellation requested from confirmed cancellation. Prevent delayed events from reverting a terminal state.
- On restart, reconstruct visible state from durable records. On reconnect, resume from the last event position or fetch an authoritative snapshot. Check whether a side effect already occurred before retrying an interrupted step. Require review when its outcome is uncertain. Preserve clear audit evidence for retry attempts and cancellations.
- Test duplicate submission, worker interruption, stale approval, process restart during a write, cancel/finish races, retention of existing history, concurrent dispatch, and duplicate or out-of-order events.

## 5. Connect desktop and enterprise jobs

- Keep PC work in OT and enterprise work in TEBE. Reuse existing authenticated sessions and approved service contracts where available. Scope every remote operation to the correct tenant, account, and workspace. Keep public TEFE surfaces limited to existing commercial, download, and authorized artifact flows.
- Implement or adapt the approved interfaces for job creation, lookup by request ID, status/events, cancellation, and authorized delivery references. Expose eligible desktop-submitted online jobs in the authenticated TEBE view.
- When a user explicitly queues online work while offline, display **Waiting for connection** and retain the request locally. Revalidate identity, tenant access, and approval on reconnect. Handle expired sessions and ambiguous submissions. Upload only user-authorized files through the approved route. Keep local workspace contents local by default.
- Verify the happy path, outage and reconnect, expired credentials, access revocation, denied cross-tenant access, and unknown remote outcomes. Use synthetic tenants and data for acceptance.

## 6. Implement the .gize extension across OT, TEBE, and TEFE

- Default every new encrypted artifact export and applicable download filename to `.gize`. Accept existing `.gaiz` and new `.gize` in open/import/upload routes, file pickers, and verification tools wherever those flows already exist. Register Windows file associations for both where supported, with `.gize` as the canonical extension for new files.
- Identify GAIZ1 or GAIZ2 using the file contents. Preserve both existing handlers, signature verification, encryption/decryption, and authorization behavior. Extension changes alone require no re-encryption. Maintain references and filenames for existing artifacts. Never bulk rename or modify users’ encrypted files during setup.
- Update CLI help, interface text, download headers, validation, and customer guidance. Publish a consistent compatibility matrix and share synthetic fixtures that include both extensions and both supported versions. Test renamed byte-identical files, mismatched headers, tampering, unauthorized recipients, missing keys, failed uploads, and round-trip verification across applicable surfaces.
- Review key storage, key recovery, and permissions before marking encrypted export production-ready. Maintain any existing release constraints around experimental protocol support. Document limits by version and by consumer.

## 7. Migrate and replace the old offline entry point

1. Build an upgrade from each supported legacy layout. Detect versions and pending jobs. Check disk space and quiesce writers before copying or migrating state. Ask users to finish or safely interrupt active work where a live migration cannot be performed.
2. Verify a consistent backup of SQLite, workspace files, preferences, and required metadata before changing the active install. Record backup location, source and target schema versions, and migration journal. Use restartable, versioned migration steps and transactions or staged commits as appropriate. Re-running setup must be safe. Preserve model paths, approvals, output references, and legacy encrypted artifacts. Use appropriate OS-managed secret migration and recovery.
3. Verify record counts, integrity, representative artifacts and permissions, shortcut and file-association behavior, and offline launch before changing the default entry point. Handle locked files, disk exhaustion, and failed or interrupted upgrades with a clear recovery path.
4. Keep a recoverable prior installer and untouched verified backup through the pilot. Document rollback for each supported baseline. Account for work created after upgrade through a verified export or compatible restore plan before reverting to an older schema. Avoid silently discarding newer work.
5. Complete pilot acceptance before switching the default download or removing a legacy launcher. Update the existing routes and installation guidance with clear ownership and version labels. Preserve user data during uninstall unless the user explicitly requests deletion.

## 8. Release verification

| Gate | Evidence required |
| --- | --- |
| Feature parity | Every supported legacy workflow has an exercised replacement or an explicitly reviewed disposition. |
| Offline Windows | Clean install, existing install upgrade, offline launch, local file workflow, scoped PC execution, task restart and verified local output. |
| Recovery | Interrupted upgrade, rollback rehearsal, crash mid-task, duplicate submission, and cancellation race. |
| Online and access | Authorized submit, progress, cancel, reconnect and delivery in test environments. Confirm isolation with synthetic tenant fixtures. |
| Artifacts | Shared GAIZ1/GAIZ2 fixtures, both extensions, legacy open, canonical export, and tamper rejection. |
| UX and performance | Keyboard and Arabic RTL checks. Repeat Windows measurements for cold/warm startup, navigation, durable acknowledgement, event-to-screen latency, large-file preview, idle/active memory and recovery. Compare to the pinned baseline on the same device. Report median, p95, case count, test inputs and raw observations. |
| Packaging | Installer, upgrade and uninstall verification, hashes, signing status, updater behavior and approved artifact distribution. Use an unsigned test candidate if signing credentials are unavailable and record the production blocker. |

Run the actual source test suites and representative integration checks. Record exact commands, commit IDs, operating-system and runtime versions, environment, failures, and reproducible evidence. A test fixture result and a live integration result must be identifiable. Use existing approved CI capacity. Treat any missing signing, Windows environment, or authorized API as a specific release blocker and continue independent implementation and validation.

## 9. Deliver and report

Deliver focused implementation branches or PRs with linked dependencies and a review sequence. Provide the Windows test candidate, checksums, install and upgrade guide, rollout and rollback playbook, revised compatibility table, and a concise validation report. Include a demo showing an existing install upgraded to OT, offline PC task execution, `.gize` export and legacy `.gaiz` open, then an authorized online task and reconnect.

Report **implemented**, **verified**, and **blocked** with commit or PR links and supporting evidence. If any acceptance criterion is open, state the exact dependency, affected workflow, and what is already working. Deliver functioning code and validated user journeys within the available environment. Production cutover is complete only after the Windows, migration, and release gates pass and the owner authorizes rollout.


Package naming note: Reference files and folders use Theepmo ref numbering. Internal archive paths were renamed and 7z payloads repackaged as ZIP. This is an analysis reference package, not a runnable installer. Rewritten paths may break captured links. Executables, libraries and opaque binary assets are not patched; their embedded original product identifiers, signatures and legal metadata may remain. This package does not claim third-party material was authored by Theepmo.