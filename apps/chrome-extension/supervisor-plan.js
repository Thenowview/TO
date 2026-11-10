/* Strict, reviewable conversion of pasted AI advice into proposed specialist tasks. */
(() => {
"use strict";
const roles = new Set(["researcher","developer","analyst","writer","browser","documents","reviewer","generalist"]);
const providerIds = new Set(["chatgpt","claude","gemini","copilot","perplexity","grok","deepseek","qwen","kimi","zai","mistral","poe","huggingchat","cloudflare_ai","doubao","yuanbao"]);
const validId = /^[a-z][a-z0-9_-]{0,39}$/;
function supervisorPrompt(instruction) {
  if (typeof instruction!=="string" || instruction.trim().length<5 || instruction.length>5000)
    throw new Error("Instruction must contain 5–5000 characters");
  return [
    "You are a planning adviser to TheOrg Supervisor; you cannot execute tools or claim completion.",
    "Interpret the owner's instruction, break it into at most eight bounded specialist tasks.",
    "Each task requires a concrete deliverable, acceptance criteria, and dependencies.",
    "For each goal specify target/source, output format, exclusions, edge cases and evidence of success.",
    "Use a dependency-aware plan; do not create parallel tasks when they modify the same resource.",
    "Require observe-act-verify steps and checkpoints for website, file or application interactions.",
    "For failures specify safe bounded recovery; never blindly repeat non-idempotent actions.",
    "Identify unknowns, consent requirements, assumptions and risks.",
    "Return only a JSON object with this schema:",
    '{"summary":"brief interpretation","tasks":[{"id":"research1","role":"researcher",',
    '"objective":"Specific task and expected outcome","provider":"chatgpt",',
    '"acceptanceCriteria":["Evidence required to demonstrate completion"],"dependencies":[]}]}',
    "Allowed roles: researcher, developer, analyst, writer, browser, documents, reviewer, generalist.",
    "Suggested providers are advisory, not proof of access. Do not include secrets.",
    "OWNER INSTRUCTION:",instruction.trim()
  ].join("\n");
}
function interpret(response) {
  if (typeof response!=="string" || response.trim().length<20 || response.length>60000)
    throw new Error("Paste the complete structured planning response (maximum 60,000 chars)");
  let parsed;
  try {
    const s=response.trim();
    const fence=String.fromCharCode(96).repeat(3);
    const body=s.startsWith(fence) && s.endsWith(fence) ?
      s.replace(new RegExp("^"+fence+"(?:json)?\\s*","i"),"").replace(new RegExp("\\s*"+fence+"$"),"") : s;
    parsed=JSON.parse(body);
  } catch { throw new Error("Provider response must be structured JSON; request the JSON plan again"); }
  if (!parsed || typeof parsed!=="object" || !Array.isArray(parsed.tasks) ||
      parsed.tasks.length<1 || parsed.tasks.length>8)
    throw new Error("The plan must have between 1 and 8 specialist tasks");
  const seen=new Set();
  const tasks=parsed.tasks.map((task,i)=>{
    if (!task || typeof task!=="object") throw new Error("Invalid task at index "+i);
    const id=String(task.id||"").trim().toLowerCase();
    const role=String(task.role||"").trim().toLowerCase();
    const objective=String(task.objective||"").trim();
    const provider=String(task.provider||"chatgpt").trim().toLowerCase();
    const acceptanceCriteria=task.acceptanceCriteria;
    const dependencies=task.dependencies||[];
    if (!validId.test(id)||seen.has(id)) throw new Error("Invalid or duplicate agent ID");
    if (!roles.has(role)||!providerIds.has(provider)) throw new Error("Unknown role or provider");
    if (objective.length<12||objective.length>2000) throw new Error("Task objective must be 12–2000 characters");
    if (!Array.isArray(acceptanceCriteria)||acceptanceCriteria.length<1||acceptanceCriteria.length>8||
        acceptanceCriteria.some(c=>typeof c!=="string"||c.trim().length<6||c.length>500))
      throw new Error("Each agent needs verifiable acceptance criteria");
    if (!Array.isArray(dependencies)||dependencies.some(d=>typeof d!=="string"||!validId.test(d)))
      throw new Error("Invalid dependencies");
    seen.add(id);
    return {id,role,objective,provider,acceptanceCriteria,dependencies,status:"planned"};
  });
  for(const task of tasks) for(const dep of task.dependencies)
    if(!seen.has(dep)||dep===task.id) throw new Error("Unknown or self dependency");
  const graph=new Map(tasks.map(t=>[t.id,t.dependencies]));
  const visiting=new Set(),visited=new Set();
  function visit(id) {
    if(visiting.has(id)) throw new Error("Dependency cycle");
    if(visited.has(id)) return;
    visiting.add(id);
    for(const dep of graph.get(id)) visit(dep);
    visiting.delete(id);visited.add(id);
  }
  for(const task of tasks) visit(task.id);
  return {summary:typeof parsed.summary==="string"?parsed.summary.slice(0,3000):"",
    tasks,source:"manually_pasted_untrusted_provider_text",reviewed:false};
}
function agentPrompt(orderTitle,plan,agentId) {
  const t=plan&&plan.tasks.find(x=>x.id===agentId);
  if(!t) throw new Error("Unknown specialist assignment");
  return ["You are a specialist adviser working for TheOrg Supervisor.",
    "Complete only the bounded assignment below and explain evidence and pending questions.",
    "Do not claim you changed files or websites unless you actually did and can show evidence.",
    "Owner approval is required for consequential actions.",
    "Original order: "+orderTitle,
    "Specialist role: "+t.role,
    "Objective: "+t.objective,
    "Acceptance criteria:",...t.acceptanceCriteria.map((c,i)=>(i+1)+". "+c),
    "Provide sources or attached artifacts when applicable.",
    "Work in cycles: inspect real state, choose the smallest authorized step, act only through available tools, and read back the result.",
    "Record evidence and statuses accurately. Proposed steps, opened tabs and self-reported success are not verified execution.",
    "Retry only safe idempotent operations; stop and surface blocked actions, missing permissions or failures.",
    "Supervisor independently reviews your work before accepting any completion."].join("\n");
}
globalThis.TheOrgPlanner={supervisorPrompt,interpret,agentPrompt};
})();