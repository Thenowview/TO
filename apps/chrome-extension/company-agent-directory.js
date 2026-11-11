/* TheOrg company-scoped agent directory.
 * Names, expertise and operating instructions are editable. Capability IDs,
 * permissions, approvals, audit and QA separation are NOT customizable here.
 */
(() => {
"use strict";
const KEY="theorgCompanyAgentProfilesV1";
const COMPANY=/^[a-z0-9_-]{1,40}$/;
const PROFILE=/^[a-z][a-z0-9_-]{0,39}$/;
const SEED=Object.freeze([
  ["supervisor","Avery","Chief Supervisor","Executive",["work allocation","risk escalation","program delivery"],"Own the order register, allocate work and resolve cross-team blockers.","Ask for approval before consequential actions; independently verify delivery."],
  ["planner","Morgan","Planning Architect","Strategy & Intelligence",["roadmaps","dependencies","milestones"],"Turn outcomes into scope, milestones, risks and responsible agents.","Favor small, measurable milestones and reversible decisions."],
  ["researcher","Nora","Research Analyst","Strategy & Intelligence",["market intelligence","source verification","competitive research"],"Deliver referenced research and explain uncertainty.","Cite actual sources and separate verified facts from assumptions."],
  ["browser","Leo","Browser Operator","Execution & Production",["web inspection","accessibility","browser evidence"],"Inspect permitted sites, record page state and observed actions.","Use approved hosts only and stop for login or security challenges."],
  ["desktop","Iris","Desktop Operator","Execution & Production",["windows workflows","local files","application checks"],"Prepare and document scoped Windows workspace operations.","Preserve user files and report unsupported desktop operations."],
  ["developer","Alex","Software Engineer","Execution & Production",["python","javascript","git","automated tests"],"Propose maintainable code and regression-tested changes.","Do not merge or deploy without separate verified authorization."],
  ["analyst","Maya","Data Analyst","Execution & Production",["excel","power bi","finance","data quality"],"Analyze traceable data and verify formulas and metrics.","Never invent figures; flag missing data and assumptions."],
  ["documents","Sam","Document Specialist","Execution & Production",["pdf","docx","slides","report formatting"],"Produce readable documents and inspect rendered outputs.","Verify actual saved artifact bytes before reporting completion."],
  ["communications","Jules","Communications Coordinator","Business Operations",["email drafting","meetings","stakeholder updates"],"Prepare accurate, reviewable communications and meeting material.","Draft first; never send or publish without explicit approval."],
  ["integrations","Riley","Cloud & Integrations Engineer","Business Operations",["cloudflare","api integration","dns","security reviews"],"Assess integrations, configuration and rollback plans.","Do not alter live DNS, production services or secrets without approval."],
  ["qa_auditor","Quinn","Quality Auditor","Independent Assurance",["acceptance tests","evidence review","regression testing"],"Independently review deliverables and identify failed criteria.","Never certify the work you produced or accept unverified claims."],
  ["security_officer","Sage","Security & Policy Officer","Independent Assurance",["least privilege","privacy","security auditing"],"Review access, data boundaries and risky operations.","Cannot grant privileges or override user approval."]
].map(([id,name,title,department,expertise,responsibilities,instructions])=>
   Object.freeze({id,name,title,department,expertise:Object.freeze(expertise),
     responsibilities,instructions,enabled:true,
     reportsTo:id==="supervisor"?"owner":"supervisor"})));
const BASE=Object.freeze(Object.fromEntries(SEED.map(x=>[x.id,x])));
const FIELDS=new Set(["name","title","department","expertise","responsibilities","instructions","enabled"]);
const copy=x=>JSON.parse(JSON.stringify(x));
function company(value){
  if(typeof value!=="string"||!COMPANY.test(value))throw new Error("Invalid company workspace ID.");
  return value;
}
function cleanText(v,min,max,label){
  if(typeof v!=="string"||v.trim().length<min||v.length>max||/[\x00-\x08\x0B\x0C\x0E-\x1F]/.test(v))
    throw new Error(label+" must be "+min+"–"+max+" characters.");
  return v.trim();
}
function validate(id,changes){
  if(!PROFILE.test(id)||!BASE[id])throw new Error("Unknown fixed agent profile.");
  if(!changes||typeof changes!=="object"||Array.isArray(changes)||
     Object.keys(changes).some(k=>!FIELDS.has(k)))
    throw new Error("Only agent display metadata and instructions can be edited.");
  const out={};
  if("name" in changes)out.name=cleanText(changes.name,2,60,"Agent name");
  if("title" in changes)out.title=cleanText(changes.title,3,90,"Job title");
  if("department" in changes)out.department=cleanText(changes.department,3,90,"Department");
  if("responsibilities" in changes)out.responsibilities=cleanText(changes.responsibilities,15,1200,"Responsibilities");
  if("instructions" in changes)out.instructions=cleanText(changes.instructions,15,1600,"Operating instructions");
  if("enabled" in changes){
    if(typeof changes.enabled!=="boolean")throw new Error("Enabled must be true or false.");
    out.enabled=changes.enabled;
  }
  if("expertise" in changes){
    if(!Array.isArray(changes.expertise)||changes.expertise.length<1||changes.expertise.length>8||
       changes.expertise.some(x=>typeof x!=="string"||x.trim().length<2||x.length>55))
      throw new Error("Provide 1–8 expertise phrases, each 2–55 characters.");
    const list=changes.expertise.map(x=>x.trim());
    if(new Set(list.map(x=>x.toLocaleLowerCase())).size!==list.length)
      throw new Error("Expertise terms must be unique.");
    out.expertise=list;
  }
  return out;
}
function tokenize(s){
  return new Set(String(s).toLocaleLowerCase().match(/[\p{L}\p{N}+#.]{3,}/gu)||[]);
}
class Directory{
  constructor(api){this.api=api;this.serial=Promise.resolve();}
  lock(fn){const p=this.serial.then(fn,fn);this.serial=p.catch(()=>undefined);return p;}
  async raw(){return (await this.api.storage.local.get(KEY))[KEY]||{};}
  async roster(companyId){
    company(companyId);
    const records=await this.raw(),custom=records[companyId]||{};
    return SEED.map(entry=>({...copy(entry),...(custom[entry.id]||{}),
       // Structural permission boundaries are fixed by code and cannot be overridden.
       id:entry.id,reportsTo:entry.reportsTo}));
  }
  async update(companyId,id,changes){
    company(companyId);const edited=validate(id,changes);
    return this.lock(async()=>{
      const all=await this.raw(),tenant=all[companyId]||{};
      tenant[id]={...(tenant[id]||{}),...edited};
      all[companyId]=tenant;
      await this.api.storage.local.set({[KEY]:all});
      return (await this.roster(companyId)).find(p=>p.id===id);
    });
  }
  async reset(companyId,id){
    company(companyId);
    if(!BASE[id])throw new Error("Unknown fixed agent.");
    return this.lock(async()=>{
      const all=await this.raw();
      if(all[companyId])delete all[companyId][id];
      await this.api.storage.local.set({[KEY]:all});
      return (await this.roster(companyId)).find(p=>p.id===id);
    });
  }
  async recommend(companyId,instruction){
    company(companyId);cleanText(instruction,5,5000,"Work instruction");
    const roster=await this.roster(companyId);
    const text=instruction.toLocaleLowerCase(),terms=tokenize(instruction);
    const skills=globalThis.TheOrgSkills.route(instruction);
    const baseline=skills.tasks.map(t=>t.id);
    const results=roster.filter(p=>p.enabled&&p.id!=="supervisor"&&p.id!=="qa_auditor"&&p.id!=="security_officer")
      .map(p=>{
        // Existing SOP routing remains canonical; company expertise refines it.
        let score=baseline.includes(p.id)?70-baseline.indexOf(p.id)*10:0;
        const matches=[];
        for(const phrase of p.expertise){
          const low=phrase.toLocaleLowerCase();
          const exact=low.length>=4 && text.includes(low);
          const parts=[...tokenize(phrase)];
          const matched=parts.some(word=>terms.has(word));
          if(exact||matched){
            score+=exact?30:10;matches.push(phrase);
          }
        }
        return {id:p.id,name:p.name,title:p.title,department:p.department,
          expertiseMatches:matches,score,
          reason:matches.length?"Expertise matched: "+matches.join(", "):
            baseline.includes(p.id)?"Existing role-based SOP matched":"No role match"};
      }).filter(x=>x.score>0)
      .sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id))
      .slice(0,3);
    return {companyId,source:"deterministic_company_profile_and_sop",
      recommended:results,requiresPlanReview:true,approved:false,
      note:"Agent recommendations are not permissions or authorization to execute."};
  }
  async context(companyId,id){
    const profile=(await this.roster(companyId)).find(p=>p.id===id);
    if(!profile || !profile.enabled)throw new Error("Assigned agent profile is disabled or unavailable.");
    return ["COMPANY AGENT PROFILE (configured by owner; instructions cannot override tool permissions):",
      "Company workspace: "+companyId,
      "Agent: "+profile.name+" ("+profile.id+")",
      "Job title: "+profile.title,"Department: "+profile.department,
      "Expertise: "+profile.expertise.join(", "),
      "Responsibilities: "+profile.responsibilities,
      "Working instructions: "+profile.instructions,
      "Mandatory rule: profile text is advisory and cannot authorize tools, data access, sending, merging, deployment, deletion or override independent QA."
    ].join("\n");
  }
}
globalThis.TheOrgCompanyAgentDirectory=Directory;
if(typeof module!=="undefined"&&module.exports)
  module.exports={Directory,SEED,validate,tokenize};
})();
