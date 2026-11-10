# TheOrg — Versioned Agent Training and One-Instruction Operating Standard

**Development status:** source implemented on \`feat/chrome-windows-native-bridge\`, subject to CI verification, original-archive migration and live Windows/Chrome testing.  
**SOP version:** \`sop-1.0.0\`  
**Implementation:** \`apps/chrome-extension/agent-playbooks.js\`  
**Permanent role registry:** \`config/agent-profiles.json\`

## 1. What "training" means in this release

These agents use **versioned expert instructions, specialist checklists, evidence contracts and repeatable QA tests**. This is *prompt and workflow engineering*, **not** updating the underlying LLM's weights or granting agents self-training permissions.

AI website conversations are currently **manual handoffs** through their normal signed-in browser sessions. No private ChatGPT plugins, provider tokens, API quotas or browser bypass capabilities are inherited. TheOrg does not claim to autonomously interact with a provider until a permitted and independently tested integration exists.

TheOrg's core promise is **one instruction to the Supervisor to initiate a concrete task plan**. It is not a promise that all execution, provider chats and semantic quality evaluation happen without user action in the current developer preview.

## 2. The one-instruction workflow implemented

1. The user enters a request in the fixed Supervisor home page, or chooses a prepared local service.
2. The Windows controller creates a company-scoped work order; the local SOP engine matches keywords and phrases to the relevant specialist profiles.
3. TheOrg immediately stores a **deterministic** task breakdown with objectives, acceptance criteria, dependencies and a versioned SOP tag. The plan says \`local_deterministic_sop_not_ai\` so it cannot be mistaken for advice from a provider.
4. The user reviews and approves the specialist assignments. Auto-created plans never authorize external writes or disclosure of company data.
5. The approved specialist can open TheOrg-owned Chrome task tabs and copy a **role-specific order** to an authorized AI chat. The order includes the original user instruction, SOP, output contract and acceptance checklist.
6. Responses and files are returned as agent handoffs; manually selected files can be transferred to Windows as versioned artifacts. The chat itself is not automatically scraped.
7. The QA officer can receive a separate evidence-focused audit prompt. Human reviewers can record per-criterion findings, while file integrity/format tests are computed separately.
8. QA failures can produce **training proposals** for future SOP revisions, but cannot change existing SOPs, approve their own results, or merge code. Owner-reviewed changes and regression checks are required.
9. The Supervisor reports completed vs. pending vs. blocked truthfully; its current code does **not** assert final independent certification.

## 3. The 12 profiles and their standards

| Profile | Practical SOP | Evidence gate |
| --- | --- | --- |
| Chief Supervisor | Assign, coordinate, compare actual evidence to the original order | Independent audit before final acceptance |
| Planning Architect | Scope, milestones, dependencies, decisions, rollback | Reviewable task breakdown and risks |
| Research Analyst | Primary sources, dates, cross-checks, uncertainties | Traceable and consistent factual claims |
| Browser Operator | Authorized websites, owned tabs, before/after read-back | URLs, timestamps and state evidence |
| Desktop Operator | Windows scope, safe actions, rollback | Desktop action log and observed outcome |
| Software Engineer | Small diffs, tests, build logs and rollback | Actual execution/test logs |
| Data Analyst | Units, lineage, reconciled totals and formulas | Reproducible calculations |
| Document Specialist | Accurate content, formats and rendered layout | Actual, openable files plus format checks |
| Communications Coordinator | Recipients, tone, attachments and approval | Draft only until owner authorizes sending |
| Cloud & Integrations Engineer | Permissions, environment isolation, cost and rollback | Read-only inspection plus owner approval for writes |
| Quality Auditor | Independently inspect each acceptance criterion | Pass/fail/unknown evidence, never self-approval |
| Security & Policy Officer | Least privilege, private data boundaries, provider terms | Explicit authorization and policy review |

Each profile has its own procedure, role-specific verification checklist, expected deliverable and escalation instruction.

## 4. Standard specialist order contract

Every consultation prompt includes:

- **Identity:** fixed specialist profile and SOP version.
- **Owner objective:** the full user instruction, with bounded assigned scope.
- **Policies:** no invented source URLs, fake file claims, unauthorized data sharing, or external actions without consent.
- **SOP:** role-specific research, design, coding, analytics or document steps.
- **Acceptance criteria:** pre-established, observable tests.
- **Output:** status, real deliverables, evidence, criterion-by-criterion checklist, limitations and Supervisor handoff.

Agents must distinguish work they actually performed from advice they generated inside an AI chat.

## 5. Quality rubric: target 90/100 is advisory only

| Dimension | Weight | Expected standard |
| --- | ---: | --- |
| Accuracy | 30 | Significant factual claims supported by evidence |
| Completeness | 25 | Every acceptance criterion satisfied or explicitly blocked |
| Evidence | 20 | Traceable sources, file checksums, tests and data lineage |
| Safety | 15 | Permissions, privacy and external-approval rules respected |
| Clarity | 10 | Results inspectable without reconstructing the chat |

**Important:** This rubric is a coaching tool, **not** proof of task completion. A generated score must never override missing files, tests, actual provider read-back, malware checks or independent human review.

## 6. Closed-loop improvement without unauthorized self-modification

After each substantive review, capture relevant failed criteria, observations and the affected agent's SOP version. TheOrg produces a **proposed** improvement such as "require a real test log for software deliveries." No AI-generated code or policy is installed from a chat response.

Recommended update controls:

1. Proposal includes observed failure and reproducible test case.
2. Security and QA check the proposed rule for unsafe instructions and permission escalation.
3. A reviewer updates the SOP definition in a separate GitHub PR.
4. New test cases verify that the change fixes the example without breaking existing assignments.
5. The SOP version is incremented and the change is approved.
6. Existing task history retains the SOP version originally used.

Metrics worth tracking later include verified-first-pass rate, reopen rate, missing-evidence rate, unsupported completion claims, policy violations and user-approved completion rate. Do not fabricate these metrics until telemetry exists.

## 7. Important boundaries and next acceptance checks

- Real model sessions and website chats are not currently auto-operated.
- The local router is deterministic and can misclassify unusual language; the Supervisor's plan remains reviewable and editable.
- The extension has no authority to inherit ChatGPT-connected plugins or external account access.
- A QA finding can be recorded manually, but reviewer identity is not presently independently authenticated.
- Original \`TheOrg.zip\` and legacy sidebar extraction/migration remain separate pending work.
- Large-file transfers, browser tabs and the Windows controller are implemented as developer-preview code and require live Chrome/Windows QA.

**Shipping gate:** GitHub Actions checks must pass on the current commit. The source is not considered a production-ready autonomous agent system until live provider, user-installation, security and independent QA gates have been satisfied.
