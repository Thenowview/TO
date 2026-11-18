# GIZE execution charter

This repository owns its own tasks and GitHub issue. Read [GIZE-CHECK.md](../GIZE-CHECK.md) on each run.

## TO scope — central reference
Shared architecture, expert coordination, requirement source inventory, protocol contracts, integration tests, release gates.

## Initial task register (provisional until source archive is indexed)
- [ ] TO-001 Register original source ZIP securely, SHA-256 and manifest
- [ ] TO-002 Extract and split source requirements into stable FE/BE/TO tasks
- [ ] TO-003 Publish architecture, dependency and naming migration map
- [ ] TO-004 Verify integration contracts, security, localization and end-to-end behavior
- [ ] TO-005 Publish cross-repo readiness report and independently verified release status

## Progress check
Review repository-level `GIZE Expert Execution` issues for TEFE and TEBE plus the master TO coordination issue. Distinguish plan presence from implementation and deployment.

## Work rules
- Use source-backed, uniquely identified requirements and small, independently reviewable PRs.
- Cross-check GitHub issues and code; never report presumed completion.
- Update progress after meaningful changes and daily while actively working.
- Keep source archive out of ordinary Git history; preserve protected access and checksum in TO.
- Production go-live requires passing checks, secure integrations, multilingual verification, deployment evidence and documented rollback.
