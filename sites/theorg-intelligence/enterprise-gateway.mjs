import { analyzeMetric, nextStatus, validateObjective, validateScope } from './intelligence-rules.mjs';
// Separate optional enterprise API. Never route a public Worker to a localhost/native host.
// If ACCESS_TEAM_DOMAIN, ACCESS_AUD or DB are missing, every business endpoint fails closed.
const json=(data,status=200)=>Response.json(data,{status,headers:{'cache-control':'no-store','x-content-type-options':'nosniff','access-control-allow-origin':'null'}});
const bad=(message,status)=>json({error:message},status);
function b64url(part){const t=part.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(t+'='.repeat((4-t.length%4)%4)),x=>x.charCodeAt(0))}
function parsePart(s){return JSON.parse(new TextDecoder().decode(b64url(s)))}
async function accessSubject(request,env){
  const team=env.ACCESS_TEAM_DOMAIN,aud=env.ACCESS_AUD;
  if(!/^[a-z0-9.-]+\.cloudflareaccess\.com$/.test(team||'')||typeof aud!=='string'||aud.length<12)throw new Error('not-configured');
  const token=request.headers.get('Cf-Access-Jwt-Assertion');
  if(!token)throw new Error('unauthorized');
  const parts=token.split('.');
  if(parts.length!==3||parts.some(x=>!x||x.length>9000))throw new Error('unauthorized');
  let header,payload;try{header=parsePart(parts[0]);payload=parsePart(parts[1])}catch(e){throw new Error('unauthorized')}
  if(header.alg!=='RS256'||typeof header.kid!=='string'||header.kid.length>255)throw new Error('unauthorized');
  const now=Math.floor(Date.now()/1000);
  if(payload.iss!=='https://'+team||!Array.isArray(payload.aud)||!payload.aud.includes(aud)||typeof payload.exp!=='number'||payload.exp<=now||typeof payload.nbf==='number'&&payload.nbf>now||typeof payload.iat==='number'&&payload.iat>now+60||typeof payload.sub!=='string'||payload.sub.length<5)throw new Error('unauthorized');
  // Require actual asymmetric JWT signature validation; never trust a claim/header alone.
  const certs=await fetch('https://'+team+'/cdn-cgi/access/certs',{redirect:'error'});
  if(!certs.ok)throw new Error('auth-key-unavailable');
  const keys=(await certs.json()).keys||[];
  const jwk=keys.find(k=>k.kid===header.kid&&k.kty==='RSA'&&k.use!=='enc');
  if(!jwk)throw new Error('unauthorized');
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'RSASSA-PKCS1-v1_5',hash:'SHA-256'},false,['verify']);
  const signed=new TextEncoder().encode(parts[0]+'.'+parts[1]);
  if(!await crypto.subtle.verify('RSASSA-PKCS1-v1_5',key,b64url(parts[2]),signed))throw new Error('unauthorized');
  return payload.sub;
}
async function roleFor(env,scope,subject){
  const row=await env.DB.prepare('SELECT role FROM memberships WHERE tenant_id=? AND company_id=? AND subject=?')
    .bind(scope.tenant_id,scope.company_id,subject).first();
  return row?.role||null;
}
export default {
 async fetch(request,env){
  const url=new URL(request.url);
  if(url.pathname==='/api/health'&&request.method==='GET')return json({status:'ok',service:'theorg-intelligence-gateway',access_configured:Boolean(env.ACCESS_AUD&&env.ACCESS_TEAM_DOMAIN&&env.DB),execution_enabled:false});
  if(!url.pathname.startsWith('/api/v1/'))return bad('Not found',404);
  if(!env.DB||!env.ACCESS_AUD||!env.ACCESS_TEAM_DOMAIN)return bad('Enterprise API not configured',503);
  let subject;try{subject=await accessSubject(request,env)}catch(e){return bad(e.message==='not-configured'?'Enterprise API not configured':'Not authenticated',e.message==='not-configured'?503:401)}
  let scope;try{scope=validateScope(url.searchParams.get('tenant'),url.searchParams.get('company'))}catch(e){return bad('Invalid company scope',400)}
  const role=await roleFor(env,scope,subject);
  if(!role)return bad('Not authorized for this company',403);
  if(url.pathname==='/api/v1/kpis'&&request.method==='GET'){
    const rows=await env.DB.prepare('SELECT metric_id,name,actual,target,lower_is_better,source_ref,period,updated_at FROM kpis WHERE tenant_id=? AND company_id=? ORDER BY metric_id LIMIT 100').bind(scope.tenant_id,scope.company_id).all();
    return json({data_status:'enterprise',company_id:scope.company_id,items:(rows.results||[]).map(k=>({...k,analysis:analyzeMetric(k)}))});
  }
  if(url.pathname==='/api/v1/proposals'&&request.method==='GET'){
    const rows=await env.DB.prepare('SELECT proposal_id,metric_id,objective,status,created_at,updated_at FROM proposals WHERE tenant_id=? AND company_id=? ORDER BY created_at DESC LIMIT 100').bind(scope.tenant_id,scope.company_id).all();
    return json({items:rows.results||[]});
  }
  if(url.pathname==='/api/v1/proposals'&&request.method==='POST'){
    if(!['analyst','executive'].includes(role))return bad('Insufficient role',403);
    if(Number(request.headers.get('content-length')||0)>8192)return bad('Payload too large',413);
    let body;try{body=await request.json()}catch(e){return bad('Invalid JSON',400)}
    let objective;try{objective=validateObjective(body?.objective)}catch(e){return bad('Invalid objective',400)}
    if(typeof body?.metric_id!=='string'||!/^[a-zA-Z0-9_-]{1,64}$/.test(body.metric_id))return bad('Invalid metric reference',400);
    const exists=await env.DB.prepare('SELECT 1 FROM kpis WHERE tenant_id=? AND company_id=? AND metric_id=?').bind(scope.tenant_id,scope.company_id,body.metric_id).first();
    if(!exists)return bad('Metric not found',404);
    const id=crypto.randomUUID(),event=crypto.randomUUID(),now=new Date().toISOString();
    await env.DB.batch([
      env.DB.prepare('INSERT INTO proposals(tenant_id,company_id,proposal_id,metric_id,objective,status,created_by,created_at,updated_at) VALUES(?,?,?,?,?,?,?,?,?)').bind(scope.tenant_id,scope.company_id,id,body.metric_id,objective,'proposed',subject,now,now),
      env.DB.prepare('INSERT INTO audit_events(tenant_id,company_id,event_id,proposal_id,actor,role,to_status,timestamp) VALUES(?,?,?,?,?,?,?,?)').bind(scope.tenant_id,scope.company_id,event,id,subject,role,'proposed',now)
    ]);
    return json({proposal_id:id,status:'proposed',execution_authorized:false},201);
  }
  // No approve/review/execute endpoint is exposed without a separately audited transaction design.
  return bad('Not found',404);
 }
};
