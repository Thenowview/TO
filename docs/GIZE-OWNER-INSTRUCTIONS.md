# GIZE Owner Instructions and Task Amendment Log

**Expert command:** `gize ot`  
**Current repository:** https://github.com/faisalwrokksa-hub/TO  
**Canonical progress issue:** https://github.com/faisalwrokksa-hub/TO/issues/71  
**Owned scope:** OT Windows app, offline workspace, GIZE artifact/cryptography, migration and cross-repository coordination.

## How the owner re-instructs this expert
Use `gize ot: <your instruction>` in ChatGPT with GitHub access, or comment directly in issue #71. Example: `gize ot: prioritize complete Arabic/English accessibility and send source-backed proof`.

The responding expert must:
1. Read the newest owner instructions here, new issue comments, the **full requirements** at https://github.com/faisalwrokksa-hub/TO/blob/main/docs/gize-sources/Theepmo-ref2.md, and the repository checklist.
2. Preserve the instruction verbatim in an issue entry or the changelog below, assign a unique change ID `CHANGE-YYYYMMDD-N`, list affected requirement IDs and target scope, and record any conflict/clarification.
3. Apply latest explicit owner instructions within safety, authorization and compatibility constraints; never silently delete past tasks. If requirements change, update relevant task wording and acceptance criteria in `docs/GIZE-SOURCE-CHECKLIST.md` and link any other affected repository.
4. Implement authorized work on reviewable branches. **After each individual task completion or change in status** update its checkbox/status and attach code PR/SHA, tests and security results, deployment evidence as applicable, and UTC time. Comment on issue #71 immediately.
5. Flag failing CI/security checks, give exact run/evidence, severity and a safe root-cause/bulk-fix plan. Do not bypass protections or merge/deploy without required release authorization.
6. Every `gize ot` run produces the **full checklist** (verified, implemented-unverified, in-progress, blocked, not started/not assessed) and explains latest owner change coverage.

## Amendment log
| Change ID | UTC timestamp | Owner instruction | Related requirement IDs | Status | Evidence/issue URL |
|---|---|---|---|---|---|
| CHANGE-20261118-1 | 2026-11-18 | Maintain exact source-backed checklist and update after every completed/reclassified task; allow owner amendments via chat/issue | ALL | ACTIVE | https://github.com/faisalwrokksa-hub/TO/issues/71 |

## Do not confuse instruction with execution
This Markdown is a persistent protocol. The check is run only when invoked by a GitHub-capable chat/agent or a separately configured and verified automation. A static MD cannot itself autonomously read tests, approve PRs, or deploy.
