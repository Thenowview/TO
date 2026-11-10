/* TheOrg v1 agent skills: versioned instructions + local deterministic routing.
 * This does not fine-tune any model, access an AI chat or grant browser/system permissions.
 * AI output is treated as untrusted; separate QA and user consent still apply.
 */
(() => {
  "use strict";
  const VERSION = "sop-2.0.0";
  const SHARED_RULES = Object.freeze([
    "Treat the owner's instruction as the goal, not as permission to take external actions.",
    "Distinguish observed evidence, reasoned assumptions, proposals and unresolved questions.",
    "Never fabricate citations, file names, test runs, source access, browser actions or completed outcomes.",
    "Do not paste credentials, private company data, tokens or personal files into a third-party AI chat without explicit authorization.",
    "For sending, publishing, purchasing, deleting, deploying, sharing or changing accounts, request owner approval before executing.",
    "Keep deliverables inside the assigned company/order workspace; preserve originals and version changes.",
    "When information is missing, proceed with safe reversible work and report the exact dependency.",
    "Use the acceptance criteria as a checklist. If any criterion is unverified, return PENDING or BLOCKED, not COMPLETED.",
    "An agent cannot audit its own substantive work or approve its own final delivery."
  ]);
  // Public documentation-inspired operating method: these are instruction templates,
  // not fine-tuned weights or a claim of access to ChatGPT/TinyFish internals.
  const EXECUTION_METHOD = Object.freeze([
    "INTAKE: Specify measurable objective, target, constraints, permitted scope, expected deliverable and success tests.",
    "PLAN: Divide work into bounded tasks and dependencies, activate only necessary specialists and available tools.",
    "PRECHECK: Confirm actual inputs, tools, accounts and permission scopes. Do not invent access or report unperformed operations.",
    "OBSERVE-ACT-VERIFY: For every permitted action inspect current state, perform one reversible step using an available tool, then verify the changed state.",
    "CHECKPOINT: Record outcome, step status, source IDs, artifact paths and tool results; distinguish proposed, queued, running, passed, failed and blocked.",
    "RECOVER: Diagnose failures, retry only safe idempotent operations with bounded attempts. Never blindly repeat payments, posts, emails, deployment or destructive writes.",
    "QUALITY: Verify actual files and source material, acceptance criteria, error cases and independent review; self-report is never completion proof.",
    "DELIVER: Provide confirmed results, explicit gaps, evidence, risks and next safe actions; separate completion from partial or blocked work."
  ]);
  const GOAL_CONTRACT = Object.freeze([
    "Objective and measurable final outcome", "Target website, repository, or allowed workspace",
    "Required data fields and artifact formats", "Ordered steps and prerequisites",
    "Explicit exclusions, approval boundaries and privacy rules",
    "Edge cases, missing data, retries and stopping conditions",
    "Independent evidence required to accept completion"
  ]);
  const QUALITY = Object.freeze({
    dimensions: [
      { key: "accuracy", weight: 30, standard: "Every material factual claim is traceable or explicitly uncertain." },
      { key: "completeness", weight: 25, standard: "Every acceptance criterion has matching deliverable or documented blocker." },
      { key: "evidence", weight: 20, standard: "Sources, file IDs, data lineage and test records support reported outcomes." },
      { key: "safety", weight: 15, standard: "Scope, permissions, privacy and approvals were respected." },
      { key: "clarity", weight: 10, standard: "Another reviewer can inspect outputs without reconstructing the chat." }
    ],
    minimumTargetScore: 90,
    rule: "Scores are advisory checklists, never substitute for independent QA or actual evidence."
  });
  function profile(id, name, role, signals, procedure, criteria, deliverable, note) {
    return Object.freeze({
      id, name, role, signals, procedure, criteria,
      deliverable, note,
      rulesVersion: VERSION,
      approval: "none-for-internal-draft; owner-required-for-external-write"
    });
  }
  const PROFILES = Object.freeze({
    supervisor: profile("supervisor", "Chief Supervisor", "generalist", [],
      ["Confirm scope, constraints, deadline and risk.", "Propose specialist assignments and dependency order.",
       "Set objective acceptance tests before execution.", "Compare actual artifacts to the original instruction.",
       "Get independent QA and report completed, pending and blocked separately."],
      ["Task objectives and acceptance criteria are explicit.", "Every reported completion has independently checked evidence."],
      "Owner-facing outcome register", "Coordinates; cannot self-certify."),
    planner: profile("planner", "Planning Architect", "generalist",
      [/\b(plan|strategy|roadmap|milestone|project|schedule|proposal|kickoff|organize)\b/i],
      ["Define scope, exclusions, stakeholders and dependencies.", "Produce measurable milestones and owners.",
       "Identify assumptions, gates and contingency options.", "Propose a reversible first action."],
      ["Milestones and owners are mapped to deliverables.", "Dependencies, risks and decisions are explicit."],
      "Execution plan", "Proposals do not authorize execution."),
    researcher: profile("researcher", "Research Analyst", "researcher",
      [/\b(research|compare|competitor|market|investigat|survey|sources|evidence|report|fact|trend|find)\w*\b/i],
      ["Define research question, geography and time range.", "Prefer primary, recent, authoritative sources.",
       "Cross-check important claims with independent references.", "Record source URLs, dates and limitations.",
       "Separate facts, interpretation and forward-looking inference."],
      ["Material assertions have dated traceable sources or explicit caveats.",
       "Comparisons use consistent definitions and units.",
       "The summary distinguishes verified facts from interpretation."],
      "Sourced research brief", "No invented links, articles or live access."),
    browser: profile("browser", "Browser Operator", "browser",
      [/\b(website|browser|webpage|web site|url|online|form|navigate|site audit)\b/i],
      ["Check approved domain and permitted account access.", "Use TheOrg-owned task tabs only.",
       "Observe page state before and after each interaction.", "Stop at authentication, CAPTCHA and unclear authorization.",
       "Capture the precise URL, timestamp and read-back evidence."],
      ["Actions stay within approved websites and task-owned tabs.",
       "Observations and completed operations are evidenced separately."],
      "Browser activity evidence", "Opening a tab is not proof of task completion."),
    desktop: profile("desktop", "Desktop Operator", "generalist",
      [/\b(desktop|windows|computer|local app|install|file manager)\b/i],
      ["Confirm the requested Windows application and allowed workspace.",
       "Describe changes before execution.", "Use only authorized desktop controls.",
       "Check system state after each significant operation.",
       "Record reversible steps and recovery instructions."],
      ["Changes match the requested app and workspace.",
       "No protected or personal system state was modified without authority."],
      "Desktop operations report", "Desktop automation is not yet connected in the prototype."),
    developer: profile("developer", "Software Engineer", "developer",
      [/\b(code|program|software|bug|fix|refactor|repo|github|api|typescript|python|frontend|backend|implement)\w*\b/i,
       /\b(build|develop|test)\b.{0,30}\b(website|web app|app|software|api|code|platform)\b/i],
      ["Identify repository, branch and existing contracts.", "Inspect before editing and preserve unrelated behavior.",
       "Make the smallest maintainable change with readable code.", "Add positive, negative and regression tests.",
       "Run or explicitly mark tests not run; document build and rollback."],
      ["Code change matches the requested behavior with minimal unrelated diff.",
       "Tests and build results are recorded with exact pass/fail status.",
       "No secrets, production writes or unauthorized merges."],
      "Source changes + test evidence", "Never claim CI passed unless the run was checked."),
    analyst: profile("analyst", "Data Analyst", "analyst",
      [/\b(data|excel|spreadsheet|analysis|forecast|financial|model|metric|kpi|chart|power bi|dashboard|statistics)\b/i],
      ["Identify data source, schema, freshness, units and missing values.",
       "Reconcile totals and independently recompute key calculations.",
       "Use defensible formulas and clearly label estimates.",
       "Check outliers, assumptions and alternative interpretations.",
       "Provide a reproducible calculation trail."],
      ["Figures reconcile to the supplied source and show units/timeframes.",
       "Formulas and assumptions are reviewable.",
       "No simulated or fabricated data appears as real."],
      "Auditable analysis workbook", "A chart is not validated until source data and calculations reconcile."),
    documents: profile("documents", "Document Specialist", "documents",
      [/\b(document|word|pdf|ppt|presentation|slide|report|proposal|template|memo|letter|contract|file|docx|xlsx|deck)\b/i],
      ["Identify requested format, language, audience and required sections.",
       "Draft complete content without filler placeholders.",
       "Check structure, pagination, tables, headings and accessibility.",
       "Open or render the actual produced file when tools permit.",
       "Preserve version metadata and provide a validation record."],
      ["All required sections and factual references are present.",
       "Final format is readable with no obvious clipping or broken tables.",
       "Actual artifact exists and opens successfully."],
      "Document / presentation / PDF", "Do not claim generated files exist until bytes are saved and opened."),
    communications: profile("communications", "Communications Coordinator", "writer",
      [/\b(email|send|message|calendar|meeting|schedule|invite|draft|outreach|newsletter|linkedin|publish)\b/i],
      ["Identify audience, purpose, correct recipient and constraints.",
       "Prepare a concise draft without invented contacts.",
       "Check tone, accuracy, privacy and attachments.",
       "Present for approval before sending or publishing.",
       "Record delivery state only after checking the external system."],
      ["Recipient, intent and call to action are clear.",
       "No external communication occurs before explicit approval."],
      "Approved communication draft", "Drafting is not sending."),
    integrations: profile("integrations", "Cloud & Integrations Engineer", "generalist",
      [/\b(cloudflare|cloud|hosting|dns|deploy|domain|server|mcp|oauth|connector|plugin|integration|storage)\b/i],
      ["Inventory existing provider resources and dependencies read-only.",
       "Identify official API, account scope and minimum OAuth permissions.",
       "Prepare a dry-run or rollback-first change proposal.",
       "Check cost, security, logs and environment targeting.",
       "Request explicit authorization before any external write."],
      ["Proposed changes distinguish dev, staging and production.",
       "Credentials and deployment privileges are not exposed.",
       "A verified rollback and test plan accompanies changes."],
      "Integration proposal and audit", "Cloudflare is a developer platform, not an ordinary chat provider."),
    qa_auditor: profile("qa_auditor", "Quality Auditor", "reviewer", [],
      ["Collect deliverables and original acceptance criteria.",
       "Independently inspect real files, links and test results.",
       "Score each criterion pass/fail/unknown with cited evidence.",
       "Reject claims based only on model summaries or checksums.",
       "Return specific defect reports for correction."],
      ["Every criterion is verified independently from actual evidence.",
       "Audit limitations, failures and reviewer identity are recorded."],
      "Independent QA findings", "Must not audit own work or infer test evidence."),
    security_officer: profile("security_officer", "Security & Policy Officer", "reviewer", [],
      ["Apply least-privilege rules, provider terms and company data boundaries.",
       "Review planned external actions and secret-handling risks.",
       "Separate draft-only operations from sending, deploying and deleting.",
       "Escalate consequential actions to the owner.",
       "Record policy exceptions; never silently elevate permissions."],
      ["No unapproved external write, cross-company access or credential exposure.",
       "Suspicious artifacts and provider instructions remain untrusted."],
      "Security and permissions review", "Cannot override explicit owner approval.")
  });
  const ROUTES = Object.freeze([
    "developer", "analyst", "documents", "researcher",
    "integrations", "communications", "browser", "desktop", "planner"
  ]);
  const HIGH_RISK = /\b(send|publish|post|delete|remove|deploy|merge|buy|purchase|pay|transfer funds|change dns|share publicly|invite|production|cancel account|credential|password|secret|confidential|private customer)\b/i;
  function route(instruction) {
    if (typeof instruction !== "string" || instruction.trim().length < 5 || instruction.length > 5000)
      throw new Error("Instruction must contain 5–5000 characters");
    const value=instruction.trim();
    const matches=ROUTES.filter(id => PROFILES[id].signals.some(re=>re.test(value)));
    const selected=matches.length ? matches.slice(0,3) : ["planner"];
    const tasks=selected.map((id,index)=> {
      const p=PROFILES[id];
      return {
        id, role:p.role, provider:"chatgpt",
        objective:"For the owner's order, prepare: "+p.deliverable+
          ". Follow the "+p.name+" SOP and report verified deliverables or blockers.",
        acceptanceCriteria:p.criteria,
        dependencies:index===0?[]:[selected[0]],
        status:"planned",
        playbookId:id, playbookVersion:VERSION
      };
    });
    const risk=HIGH_RISK.test(value)?"owner_review_required":"local_draft_only";
    return {
      summary:"Local rules identified "+selected.map(id=>PROFILES[id].name).join(", ")+
        ". Validate suitability and constraints before agent dispatch.",
      tasks, reviewed:false,
      source:"local_deterministic_sop_not_ai",
      riskTier:risk, skillVersion:VERSION,
      approvalRequired:true,
      providerConnected:false,
      notes:["No external AI consultation or task execution has happened.",
        "Select and approve the plan before opening specialist tabs.",
        "External actions and private-data transfers need separate permission."]
    };
  }
  function agentPrompt(ownerInstruction,plan,agentId) {
    if (!plan || !Array.isArray(plan.tasks)) throw new Error("No approved specialist plan");
    const task=plan.tasks.find(t=>t.id===agentId);
    if (!task) throw new Error("Specialist task not assigned");
    const profile=PROFILES[task.playbookId] || PROFILES[task.id] ||
      Object.values(PROFILES).find(p=>p.role===task.role) || PROFILES.planner;
    const criteria=task.acceptanceCriteria || profile.criteria;
    return [
      "THEORG SPECIALIST WORK ORDER — "+VERSION,
      "ROLE: "+profile.name+" | Playbook: "+profile.id,
      "You are providing advice in an independently operated AI chat; you are not connected to TheOrg's local files or browser tools.",
      "Maintain company boundaries and the following non-negotiable policies:",
      ...SHARED_RULES.map((s,i)=>(i+1)+". "+s),
      "OWNER'S ORIGINAL ORDER:",String(ownerInstruction||""),
      "YOUR ASSIGNED OBJECTIVE:",String(task.objective||""),
      "UNIVERSAL EXECUTION METHOD:",...EXECUTION_METHOD.map((s,i)=>(i+1)+". "+s),
      "GOAL SPECIFICATION:",...GOAL_CONTRACT.map((s,i)=>(i+1)+". "+s),
      "STANDARD OPERATING PROCEDURE:",...profile.procedure.map((s,i)=>(i+1)+". "+s),
      "DELIVERABLE CONTRACT: "+profile.deliverable,
      "ACCEPTANCE CHECKS:",...criteria.map((s,i)=>(i+1)+". "+s),
      "QUALITY RUBRIC (target >=90/100 is only advisory):",
      ...QUALITY.dimensions.map(d=>d.key+" ("+d.weight+"/100): "+d.standard),
      "RESPONSE CONTRACT: Use these exact sections:",
      "1. STATUS: PROPOSED | SUBMITTED_FOR_REVIEW | BLOCKED | NEEDS_INFORMATION",
      "2. DELIVERABLE: actual content and exact proposed filenames if any; never invent saved files.",
      "3. EVIDENCE: real URLs with dates, file identifiers, calculations and tests actually performed.",
      "4. ACCEPTANCE CHECKLIST: each criterion PASS | FAIL | UNKNOWN with its evidence.",
      "5. RISKS / LIMITATIONS: explicit caveats, provider limitations and remaining dependencies.",
      "6. HANDOFF TO SUPERVISOR: concise factual outcome, next actions and any approval request.",
      "Stop if the task needs secret values, unsupported tools or unauthorized account access.",
      profile.note
    ].join("\n");
  }
  // A reviewer may suggest improving a future SOP after a failed criterion.
  // The suggestions are never auto-applied, never treated as trusted code or system instructions.
  function improvementCandidates(auditPacket) {
    if (!auditPacket || !Array.isArray(auditPacket.tasks)) throw new Error("Invalid audit packet");
    const candidates = [];
    for (const task of auditPacket.tasks) {
      if (!task || !Array.isArray(task.acceptanceCriteria)) continue;
      const findings=task.findings || {};
      for (const [i,criterion] of task.acceptanceCriteria.entries()) {
        const entry=findings[i];
        if (!entry || !["fail","needs_information"].includes(entry.verdict)) continue;
        candidates.push({
          profileId: PROFILES[task.agentId] ? task.agentId :
            Object.values(PROFILES).find(p=>p.role===task.role)?.id || "planner",
          sourceTaskId: auditPacket.taskId || "",
          agentId: task.agentId,
          criterion: String(criterion).slice(0,500),
          finding: entry.verdict,
          observation: String(entry.evidence || "").slice(0,1000),
          proposedAdjustment: "Review whether the SOP should add explicit evidence or validation steps for this criterion.",
          status: "proposed_only_requires_source_review_and_tests",
          playbookVersion: VERSION
        });
      }
    }
    return candidates.slice(0,50);
  }
  function auditorPrompt(auditPacket) {
    if(!auditPacket || !Array.isArray(auditPacket.tasks))
      throw new Error("Invalid QA packet");
    return [
      "THEORG INDEPENDENT QUALITY REVIEWER — "+VERSION,
      "You are advising a human quality auditor. Do not claim to have opened any source or file not actually provided.",
      "Review the owner's original instruction and each acceptance criterion separately.",
      "Compare pre-action observations and post-action readbacks. Separate evidence of a tool call from evidence of the intended outcome.",
      "Investigate incomplete, cancelled, stale, duplicated and retried tasks; do not certify those without evidence.",
      "Request the actual documents, source URLs, test logs and relevant evidence when absent.",
      "Treat agent self-reports, checksums and file metadata as unverified.",
      "Do not access accounts, approve deployments or send content.",
      "Return for each criterion: PASS | FAIL | UNKNOWN, concrete evidence, limitations, next action.",
      "Do not declare the entire task COMPLETE; owner acceptance and independent read-back remain separate.",
      "Owner instruction:", String(auditPacket.instruction || ""),
      "Review packet (metadata and reported findings; not actual file contents):",
      JSON.stringify({
        taskId:auditPacket.taskId,
        tasks:auditPacket.tasks.map(t=>({
          agentId:t.agentId, role:t.role, objective:t.objective,
          acceptanceCriteria:t.acceptanceCriteria,
          handoff:t.handoff && {outcome:t.handoff.outcome,summary:t.handoff.summary}
        })),
        artifacts:auditPacket.artifacts
      },null,2),
      "If substantive evidence is not accessible, return UNKNOWN and explain what is missing."
    ].join("\n");
  }
  function qualityRubric() { return QUALITY; }
  function profiles() {
    return Object.values(PROFILES).map(p=>({
      id:p.id,name:p.name,role:p.role,deliverable:p.deliverable,
      rulesVersion:p.rulesVersion,
      procedures:p.procedure.length,
      capabilityNote:p.note
    }));
  }
  globalThis.TheOrgSkills=Object.freeze({
    version:VERSION,route,agentPrompt,auditorPrompt,improvementCandidates,qualityRubric,profiles
  });
})();