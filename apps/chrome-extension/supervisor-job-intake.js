/* ChatGPT-assisted explicit job enquiry. Outputs are inert and require review. */
(() => {
"use strict";
function prompt(instruction,answers=""){
  if(typeof instruction!=="string"||instruction.trim().length<5||
     instruction.length>5000||typeof answers!=="string"||answers.length>2500)
    throw new Error("Job objective or answers outside allowed limits.");
  return [
    "You are the ChatGPT planning adviser for TheOrg AI Supervisor.",
    "Clarify a real work request; do not perform work or claim tools were used.",
    "Ask only safety-critical or output-defining questions; no more than three.",
    "When essential information is missing, return JSON exactly in this shape:",
    '{"kind":"clarification","summary":"What I understood","questions":["Specific question 1","Specific question 2"]}',
    "When actionable, return a JSON object with TheOrg plan schema:",
    '{"kind":"job_request","summary":"Task interpretation","tasks":[{"id":"research1","role":"researcher","objective":"Scoped deliverable","provider":"chatgpt","acceptanceCriteria":["Observable output"],"dependencies":[]}]}',
    "Use 1–8 specialist tasks, each with real deliverables and acceptance criteria.",
    "Roles: researcher, developer, analyst, writer, browser, documents, reviewer, generalist.",
    "Automated provider choices: chatgpt and claude only.",
    "Prioritize dependencies. Never schedule concurrent agents to change the same file.",
    "Never assume private files, websites, external accounts or tools are connected.",
    "Sending, deleting, deploying, publishing, purchasing or permissions changes need separate owner approval.",
    "Return only JSON. Do not create fake results, citations or completion evidence.",
    "Original user instruction:\n"+instruction.trim(),
    answers.trim()?"User clarification answers:\n"+answers.trim():""
  ].filter(Boolean).join("\n");
}
function parse(raw){
  if(typeof raw!=="string"||raw.length>90000)throw new Error("Invalid AI adviser response.");
  let text=raw.trim();
  if(text.startsWith("\x60\x60\x60"))text=text.replace(/^\x60\x60\x60(?:json)?\s*/i,"").replace(/\s*\x60\x60\x60$/,"");
  let obj;try{obj=JSON.parse(text);}catch{
    return {kind:"unstructured",note:"ChatGPT did not return structured JSON. Review the saved response manually."};
  }
  if(!obj||typeof obj!=="object"||Array.isArray(obj))
    return {kind:"unstructured",note:"AI response was not a JSON object."};
  if(obj.kind==="clarification"&&Array.isArray(obj.questions)){
    const questions=obj.questions
      .filter(s=>typeof s==="string"&&s.trim().length>=8&&s.length<=260).slice(0,3);
    if(questions.length)
      return {kind:"clarification",summary:String(obj.summary||"").slice(0,600),questions};
  }
  if(obj.kind==="job_request"&&Array.isArray(obj.tasks)&&
     obj.tasks.length>=1&&obj.tasks.length<=8){
    try{
      const normalized={summary:obj.summary,tasks:obj.tasks};
      const plan=globalThis.TheOrgPlanner.interpret(JSON.stringify(normalized));
      return {kind:"job_request",summary:String(plan.summary||"").slice(0,600),
        planJson:JSON.stringify(normalized),taskCount:plan.tasks.length,reviewed:false};
    }catch{return {kind:"unstructured",note:"AI task proposal failed TheOrg validation."};}
  }
  return {kind:"unstructured",note:"AI answer lacks valid clarification questions or a job proposal."};
}
const api=Object.freeze({prompt,parse});
globalThis.TheOrgJobIntake=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})();