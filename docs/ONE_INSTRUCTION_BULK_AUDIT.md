# TheOrg — One-instruction workflow bulk audit

**Branch:** \`feat/chrome-windows-native-bridge\`  
**PR:** https://github.com/faisalwrokksa-hub/TO/pull/2 (draft)  
**Scope:** local-first Supervisor → versioned SOP plan → safe manual Chrome AI handoff → agent output → artifact intake → QA evidence → pending/blocked report.

## What was implemented in this batch

1. **Dependency-aware task queue** — The Supervisor knows which specialist can be consulted next. A dependent specialist remains blocked until prerequisite agents have submitted handoffs and there are manually recorded acceptance-criterion passes.
2. **One-click dispatch** — The user can click **Open next eligible agent**. TheOrg opens a TheOrg-owned tab, returns the structured SOP instructions and attempts to copy them locally. It does not paste secrets, send prompts or operate third-party AI chats automatically.
3. **No duplicate task tabs** — An agent cannot silently open a second owned tab while one is already active.
4. **File-integrity gating** — A QA pass alone cannot advance a dependent task when the agent's latest files have invalid integrity, missing structure validation or an incomplete intake state.
5. **QA invalidation on file revisions** — Importing a new version of an agent artifact removes that agent's old acceptance findings. The original version remains in the versioned library.
6. **Revision-aware final review** — Latest file versions drive intake validity. Historic malformed versions are preserved for audit but do not permanently block an independently corrected version.
7. **Remove demo dependency** — Generated test files (\`plan.md\`, \`work-product.md\`) are not prerequisites for an actual work order's acceptance.
8. **Automatic deterministic file validation** — After a user-authorized file import, the UI triggers integrity and structural checks. It never interprets these as semantic approval or malware-scan certification.
9. **Chrome restart recovery** — Agent session summary is saved in extension-local task metadata. If session-only Chrome tab ownership is lost after restart, TheOrg marks the assignment as **untracked** and will not close or reconstruct unknown browser tabs. The user can explicitly create a new owned tab. The previous tabs remain untouched.
10. **Supervisor UI contract tests** — The CI suite checks referenced page IDs, bundled assets, extension routing and real controller tests. Static contracts and simulated Chrome API tests are not real Chrome end-to-end certification.

## State boundaries

| State | Meaning | Can the user treat the task as independently complete? |
|---|---|---|
| plan_review_required | Local/AI proposed plan must be approved for specialist dispatch | No |
| ready_for_manual_provider_consultation | Next agent may open a task-owned chat tab | No |
| agent_tab_open | Agent's TheOrg-owned provider tab is tracked | No |
| browser_session_untracked | Session ownership lost; explicit recovery required | No |
| waiting_on_dependencies | Requires upstream handoff and QA findings | No |
| artifact_validation_pending | Latest imported file has not passed file checks | No |
| awaiting_qa_evidence | Agent submitted, acceptance evidence not fully recorded | No |
| needs_revision | At least one QA criterion failed or more information is needed | No |
| manual_qa_pass_unverified | Manually marked QA criteria passed; reviewer identity not authenticated | No |
| manual_qa_recorded_owner_confirmation_pending | Supervisor review has manual QA findings but cannot independently certify | No |

## Existing restrictions maintained

- Each external AI website is an **authorized manual handoff only**. TheOrg does not inherit ChatGPT-connected plugins or credentials.
- No automatic external action: sending, publishing, deploying, sharing, deleting, purchases or account-security changes require separate authorization.
- Original TheOrg and sidebar ZIP archives have **not** been imported or fully source-audited in this GitHub repository. Do not treat this development branch as their replacement.
- Old browser tabs without verifiable in-session ownership must not be auto-closed.
- No file hash, file signature, manual QA checkbox or agent statement establishes substantive completion.

## Acceptance checklist

- [x] Agent SOPs and local one-instruction planning are committed.
- [x] Task queue and next-agent dispatch code committed.
- [x] Dependency, file revision and tab-recovery regression tests committed.
- [x] UI control/extension-routing contract tests committed.
- [ ] Independently verify a real Chrome+Windows installation with an actual user profile.
- [ ] Import and reconcile historical TheOrg/sidebar source from the original ZIPs.
- [ ] Build and review provider-specific integrations through documented authorization.
- [ ] Implement separately authenticated QA and independent semantic/artifact read-back.
- [ ] Complete security review, signing and production release.

**CI verification:** See the most recent successful run on https://github.com/faisalwrokksa-hub/TO/actions. Do not mark this batch tested until both \`js-syntax\` and \`windows-bridge\` jobs succeed on its final commit.
