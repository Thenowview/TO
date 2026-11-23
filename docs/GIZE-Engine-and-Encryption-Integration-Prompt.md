# GIZE Engine and encrypted file integration prompt

Integrate the GIZE Windows workspace with Orgaiz downloads and THEEPMO encrypted document workflows. Keep the Windows runtime and file format in TO, marketing and distribution in TEFE, and enterprise permissions, application routes, and storage in TEBE. Use the current default branches and cite the exact source revision for each repository in the final handoff.

## Start with the current contracts

1. Read the repository instructions, current implementation baseline, release workflow, and GIZE verification checklist. Identify the actual codec, application entry points, artifact storage paths, and Windows build workflow before proposing changes.
2. Use the TO master register and the existing cross-repository fixtures as the acceptance reference. Follow the live code and reproducible tests when a historical status or draft conflicts with them.
3. Keep the public product description consistent across surfaces. **GIZE is a local-first Windows workspace that can research through job-scoped AI browser tabs.** Label the portable build as a preview and list the runtime, model, and provider prerequisites that apply to the specific package.

## Windows workspace and engine

- Offer three engine choices beside Send. New conversations open with a task greeting and select Local Adaptive. AI Tab allocates a reachable job-owned tab, respecting the user's favorite. API-linked uses a configured API profile and identifies when the result comes from web search.
- Keep favorites, API profile editing, and automatic fallback in Settings. Attempt the local engine first. Automatic fallback applies to completed local failures or an explicit request for help and follows the destination saved by the user. Keep interrupted and stopped actions eligible for deliberate review and retry.
- Send only the original question when the user chooses an API route or enables that fallback. Keep job files, history, and memory out of that request. Browser accounts use isolated job profiles. Preserve group membership through a provider popup and close the group when the user captures the answer.
- Recalculate the local worker budget from the lower of available physical memory and commit headroom for each run. Enforce the measured worker limit and close owned child processes and tabs when GIZE closes. Surface a clear message when a model or runtime is missing or the worker cannot fit.

## Encrypted file interoperability

- Follow the checked-in envelope specification and test vectors. The current baseline uses **.gize** for new encrypted exports and reads legacy **.gaiz** files. Preserve the existing GAIZ1 and GAIZ2 wire identifiers, signature coverage, and key semantics. Detect and verify envelopes from their bytes and policy as well as the file extension.
- Validate the full envelope and enforce size limits before processing embedded data. Verify integrity, any required signature, and current authorization before releasing plaintext. Record only safe metadata and structured failure codes. Use a temporary file and verified atomic promotion for local writes.
- Enforce tenant, recipient, and artifact access at the enterprise boundary. Apply expiry, revocation, and offline access as specified by the current policy. Keep encryption keys in the approved key store. Use the Windows key store for approved local secrets and the application's approved backend vault for server secrets.
- Keep credential material separate from job notes and artifacts. Restrict transfer of decrypted content to explicitly authorized destinations. An attached encrypted artifact becomes model input only after a permitted decrypt-and-review flow.

## Work in the owning repository

| Repository | Required work |
| --- | --- |
| TO | Locate the Windows shell, native bridge, adaptive worker, and canonical codec. Add or repair the open, export, verify, and handoff paths using the same codec and fixtures. Produce a versioned x64 preview, prerequisites, checksum, and reproducible validation receipt. |
| TEBE | Connect authorized import and export through the existing enterprise document or artifact service. Exercise tenant and role controls, metadata parity, and error handling. Use synthetic tenants and preserve the current authentication and data model. |
| TEFE | Link the GIZE App download to the verified immutable release artifact. Display version, architecture, prerequisites, and SHA-256. Use the established marketing release builder and current localization registry. Verify that the link serves the expected ZIP and that the site uses the approved release version. |

## Acceptance evidence

1. Build on a clean Windows x64 environment with the documented prerequisites. Verify installation or extraction, offline launch, workspace reopen, explicit fallback, app shutdown, and existing-profile upgrade.
2. Exercise a real adaptive model on chat, CSV, JSON, Markdown, and a tool-backed task. Report pass counts, timings, worker limits, and the model version. Record fixture results and live provider sign-in as distinct evidence.
3. Export with one authorized client and verify and decrypt on the others. Test legacy GAIZ1 and GAIZ2 fixtures, newly exported .gize, a bad signature, a tampered header or payload, a wrong key, an unauthorized tenant, and a truncated or oversized file. Confirm that failures leave a coherent job and no usable partial plaintext.
4. Verify signed-in browser completion and the saved API route with synthetic questions. Confirm isolation across jobs, authoritative source references for web search, and stoppable requests.
5. Record the package SHA-256, dependency notices, signature status, PRs, tests, and exact release URL. Use the owner's release authorization and repository checks to promote the reviewed artifact. Record any remaining gaps and their reproduction steps.
