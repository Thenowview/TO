/* TheOrg Supervisor: human-readable starter instructions, not autonomous execution.
 * These are local examples; choosing one NEVER submits an order or opens a provider.
 */
(() => {
  "use strict";
  const VERSION = "2026-11-11.1";
  const COMMON_RULES = [
    "Work inside the selected TheOrg company/order workspace. Do not assume access to files, accounts, websites or external tools.",
    "First produce a bounded plan with deliverables, dependencies, acceptance criteria and any missing prerequisites.",
    "Distinguish proposed actions from actions actually performed. Never invent testing, citations, approvals or deliverables.",
    "Before sending, deleting, publishing, buying, installing, deploying, merging or changing permissions, request explicit authorization.",
    "When execution tools or required data are unavailable, produce the best safe plan or draft and label blockers instead of claiming completion.",
    "After approved work, provide a short result, actual evidence, remaining risks and next action."
  ];
  const TEMPLATES = Object.freeze([
    {id:"feature",category:"Build",title:"Build a feature",description:"Plan, implement and test a focused app improvement.",
     prompt:"Improve an existing software project by implementing one useful feature. Inspect the permitted project context first. Identify files to change, prepare a dependency-aware plan, propose minimal edits, add or update tests, and report actual test results and a reversible change record. Do not deploy or merge."},
    {id:"bug",category:"Build",title:"Fix a bug",description:"Diagnose, reproduce, repair and verify.",
     prompt:"Investigate a reproducible bug in the selected software project. Identify observed symptoms and likely root cause, propose the smallest safe fix, preserve existing behavior, and specify reproduction and regression tests. Execute only permitted tests and report their actual results. Roll back unsuccessful changes."},
    {id:"code-review",category:"Build",title:"Audit code quality",description:"Find security, reliability and maintainability issues.",
     prompt:"Perform a read-only code review of the authorized project. Prioritize concrete security vulnerabilities, functional regressions, missing tests, unsafe dependencies and maintainability risks. Cite exact files and lines when available. Recommend fixes ordered by severity. Do not edit, merge, push or deploy."},
    {id:"website",category:"Build",title:"Improve a website",description:"Usability, navigation, accessibility and performance.",
     prompt:"Review an authorized website or local frontend for usability, responsive design, accessibility, performance and visual consistency. Distinguish inspected pages from assumptions. Propose a clear prioritized design plan and accessible acceptance criteria. Only change code after explicit approval; do not deploy."},
    {id:"dashboard",category:"Build",title:"Create a dashboard",description:"Design information views with real-data boundaries.",
     prompt:"Design a useful dashboard for the stated audience. Define user questions, metrics, data availability, navigation, filters, responsive layout, empty/error states and verification criteria. Use clearly labeled synthetic data if real data is unavailable. Propose implementation steps without implying live integrations exist."},
    {id:"research",category:"Analyze",title:"Research a topic",description:"Structured briefing with sourced findings.",
     prompt:"Research and summarize the selected topic using only sources actually accessible to the authorized agent. Separate verified facts from interpretation, compare credible perspectives, flag dates and uncertainty, and produce an executive summary plus a source list. If browsing is unavailable, prepare a research plan and identify missing sources."},
    {id:"spreadsheet",category:"Analyze",title:"Analyze data",description:"Clean, validate and explain a dataset.",
     prompt:"Analyze an authorized dataset. Inventory fields, missing values, duplicates and assumptions, choose relevant calculations and visualizations, and prepare a clear report with traceable formulas and limitations. Never invent measurements; request access or mark data unavailable when needed."},
    {id:"project-plan",category:"Analyze",title:"Plan a project",description:"Milestones, owners, risks and dependencies.",
     prompt:"Turn the objective into a practical execution plan. Define scope, exclusions, workstreams, milestones, dependencies, stakeholder responsibilities, risks and measurable acceptance criteria. Propose the smallest useful first milestone and highlight any decisions requiring my approval."},
    {id:"files",category:"Operate",title:"Organize local files",description:"Audit first; no automatic deletions.",
     prompt:"Create an inventory and organization proposal for files in an explicitly authorized workspace. Identify duplicates, unclear names, archival candidates and a proposed folder structure. Preserve originals, run in read-only/dry-run mode first, and request separate approval before moving, overwriting or deleting anything."},
    {id:"browser",category:"Operate",title:"Browser task",description:"Bounded navigation with evidence.",
     prompt:"Plan an authorized browser task for an explicitly named website and account. Specify allowed pages, exact steps, expected evidence and safe recovery if access or controls fail. Do not claim that browsing, clicking or submitting occurred without observed evidence. Require separate approval for any irreversible or external action."},
    {id:"workflow",category:"Operate",title:"Audit an AI workflow",description:"Check agent handoffs and completion evidence.",
     prompt:"Review an existing AI-agent workflow and its task records. Check objectives, role handoffs, dependencies, authorization scope, stale or interrupted work, actual output evidence and QA findings. Return completed versus blocked work, risks, recovery steps and a concise next-action list. Never certify unverified agent claims."},
    {id:"document",category:"Communicate",title:"Write a professional report",description:"Clear draft with review checklist.",
     prompt:"Prepare a concise professional report based on provided, authorized material. Include purpose, key findings, evidence, practical recommendations, caveats and a final review checklist. Distinguish supplied facts from assumptions and label any missing references. Produce a draft only until I approve publication."},
    {id:"email",category:"Communicate",title:"Draft email or reply",description:"Ready-to-review communication without sending.",
     prompt:"Draft a professional email or reply for the described objective. Specify the audience, subject, key message, call to action and appropriate tone. Do not invent recipients, addresses, commitments or facts. Deliver an editable draft and request my permission before sending."},
    {id:"meeting",category:"Communicate",title:"Prepare a meeting",description:"Agenda, decisions and action items.",
     prompt:"Prepare a practical meeting pack: purpose, proposed agenda, participants by role, decisions needed, time allocation, open risks and a reusable action log. Produce a follow-up minutes template. Never claim a meeting was held or calendar invitations were sent."}
  ].map(t => Object.freeze(t)));
  const CATEGORIES = Object.freeze(["All","Build","Analyze","Operate","Communicate"]);
  function list({category="All",query=""}={}) {
    if (!CATEGORIES.includes(category)) throw new Error("Unknown prompt category");
    if (typeof query !== "string" || query.length > 120) throw new Error("Search must be under 120 characters");
    const needle=query.trim().toLocaleLowerCase();
    return TEMPLATES.filter(t => (category==="All"||t.category===category) &&
      (!needle || [t.title,t.description,t.prompt,t.category].some(s=>s.toLocaleLowerCase().includes(needle))));
  }
  function prepare(id,focus="") {
    if (typeof id!=="string") throw new Error("Unknown prompt");
    const template=TEMPLATES.find(t=>t.id===id);
    if (!template) throw new Error("Unknown prompt");
    if (typeof focus!=="string" || focus.length>240) throw new Error("Focus must be under 240 characters");
    const text=[
      "THEORG AI SUPERVISOR — WORK ORDER",
      "Goal: "+template.title,
      focus.trim() ? "Specific project / topic: "+focus.trim() : null,
      "Instruction: "+template.prompt,
      "Operating instructions:",
      ...COMMON_RULES.map((line,i)=>(i+1)+". "+line),
      "Requested handoff: a concise reviewable plan first, with expected output, responsible roles and acceptance checks."
    ].filter(Boolean).join("\n");
    if (text.length>5000) throw new Error("Instruction exceeds TheOrg's 5,000-character limit");
    return text;
  }
  const api=Object.freeze({version:VERSION,categories:CATEGORIES,templates:TEMPLATES,list,prepare});
  globalThis.TheOrgSupervisorStarters=api;
  if (typeof module!=="undefined" && module.exports) module.exports=api;
})();
