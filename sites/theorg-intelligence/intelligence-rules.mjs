// Deterministic intelligence rules; no AI, network or external execution.
const STATUSES = ['proposed','approved','qa-reviewed','closed','rejected'];
export function analyzeMetric(metric) {
  const {actual,target,lower_is_better}=metric||{};
  if(!Number.isFinite(actual)||!Number.isFinite(target)||actual<0||actual>100||target<0||target>100||![true,false,0,1].includes(lower_is_better))throw new TypeError('Invalid KPI');
  const gap=Math.round(Math.abs(actual-target)*100)/100;
  const meetsTarget=Boolean(lower_is_better)?actual<=target:actual>=target;
  return {actual,target,gap,meets_target:meetsTarget,direction:Boolean(lower_is_better)?'lower_is_better':'higher_is_better',recommended_action:meetsTarget?'monitor':'request_owner_evidence'};
}
export function nextStatus(current,action,actorRole,creator,actor,evidenceDigest) {
  if(!STATUSES.includes(current))throw new Error('Unknown state');
  const transitions={
    proposed:{approve:['approved','executive'],reject:['rejected','executive']},
    approved:{review:['qa-reviewed','reviewer'],reject:['rejected','executive']},
    'qa-reviewed':{close:['closed','executive'],reject:['rejected','executive']}
  };
  const rule=transitions[current]?.[action];
  if(!rule||rule[1]!==actorRole)throw new Error('Transition forbidden');
  if(action==='review'&&(actor===creator||!/^sha256:[0-9a-f]{64}$/.test(evidenceDigest||'')))throw new Error('Independent reviewer and verified evidence digest required');
  if(action==='close'&&!/^sha256:[0-9a-f]{64}$/.test(evidenceDigest||''))throw new Error('Evidence required for closure');
  return rule[0];
}
export function validateScope(tenant,company) {
  const regex=/^[a-zA-Z0-9_-]{1,64}$/;
  if(!regex.test(tenant||'')||!regex.test(company||''))throw new Error('Invalid scope');
  return {tenant_id:tenant,company_id:company};
}
export function validateObjective(value) {
  if(typeof value!=='string'||value.trim().length<8||value.length>500)throw new Error('Invalid objective');
  return value.trim();
}
