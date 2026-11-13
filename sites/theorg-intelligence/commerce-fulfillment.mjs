/**
 * TheOrg commercial fulfillment core — server-side ONLY.
 * NOT imported by any static Worker. Never accepts client-submitted payment status.
 * Stripe-compatible webhook verification is a staged adapter, NOT an active merchant.
 * No checkout provider, customer identity provider, D1/R2, keys or paid AI is connected.
 */
import {createHash,createHmac,timingSafeEqual,randomUUID} from 'node:crypto';
import {COMMERCIAL_TOOLS,analyzeCommercialTool} from './commercial-tools.mjs';
import {buildReport,exportArtifact} from './report-engine.mjs';

const must=(ok,message)=>{if(!ok)throw new Error(message)};
const safeId=(v)=>typeof v==='string'&&/^[A-Za-z0-9_-]{2,96}$/.test(v);
const serial=value=>JSON.stringify(value);
const digest=value=>createHash('sha256').update(serial(value)).digest('hex');
const ONE_OFF_PRODUCTS=new Map(COMMERCIAL_TOOLS.map(t=>[t.id,t]));
const SUPPORTED=['checkout.session.completed','checkout.session.async_payment_succeeded'];
const copy=x=>structuredClone(x);
const boundString=(v,n=256)=>typeof v==='string'&&v.length>0&&v.length<=n;
export const COMMERCE_MODES=Object.freeze({preview:'preview-only',payment:'provider-not-connected',member:'identity-not-connected'});

export function quoteReport(toolId,input){
 const tool=ONE_OFF_PRODUCTS.get(toolId);
 must(tool,'Unknown report product');
 const result=analyzeCommercialTool(toolId,input);
 const amount=tool.price_usd*100;
 must(Number.isSafeInteger(amount)&&amount>0,'Invalid catalog price');
 return Object.freeze({
   tool_id:toolId,product_name:tool.name,amount_cents:amount,currency:'usd',
   report_type:result.report_type,input_digest:'sha256:'+digest(input),
   preview_digest:'sha256:'+digest(result.calculated_metrics),
   provenance:'self-reported',checkout_enabled:false
 });
}

/** Identity passed here must be verified by a separate authentication gateway. */
export function createDraftOrder({quote,identity,id=randomUUID(),now=new Date().toISOString()}){
 must(quote&&ONE_OFF_PRODUCTS.has(quote.tool_id),'Unknown quote');
 const tool=ONE_OFF_PRODUCTS.get(quote.tool_id);
 must(quote.amount_cents===tool.price_usd*100&&quote.currency==='usd'&&quote.checkout_enabled===false,'Client amount mismatch');
 must(safeId(identity?.tenant_id)&&safeId(identity?.subject_id),'Verified tenant and customer identity required');
 must(safeId(id),'Invalid order id');
 must(Number.isFinite(Date.parse(now)),'Invalid timestamp');
 return Object.freeze({
  id,tenant_id:identity.tenant_id,subject_id:identity.subject_id,tool_id:tool.id,
  amount_cents:quote.amount_cents,currency:'usd',report_type:tool.report_type,
  input_digest:quote.input_digest,preview_digest:quote.preview_digest,
  session_id:null,payment_event_id:null,processed_events:[],
  state:'draft',created_at:now,updated_at:now,
  source_verified:false,qa_accepted:false,report_digest:null,
  delivery_ref:null,report_status:'not-generated',payment_provider:'not-connected'
 });
}
export function assertOwner(order,identity){
 must(order&&safeId(identity?.tenant_id)&&safeId(identity?.subject_id),'Verified principal required');
 must(order.tenant_id===identity.tenant_id&&order.subject_id===identity.subject_id,'Order not found');
 return true;
}
export function attachProviderSession(order,sessionId,{provider='stripe',now=new Date().toISOString()}={}){
 must(order?.state==='draft','Order not ready for checkout session');
 must(provider==='stripe','Unsupported payment provider');
 must(typeof sessionId==='string'&&/^cs_(?:test|live)_[A-Za-z0-9]{6,120}$/.test(sessionId),'Invalid provider checkout session');
 return Object.freeze({...order,session_id:sessionId,state:'pending_payment',payment_provider:provider,updated_at:now});
}
/** Verify signature over the RAW request body, with timestamp tolerance and timing-safe comparison. */
export function verifyStripeWebhook({rawBody,signatureHeader,secret,nowSeconds=Math.floor(Date.now()/1000)}){
 must(typeof rawBody==='string'&&rawBody.length>0&&rawBody.length<=262144,'Invalid webhook payload');
 must(typeof signatureHeader==='string'&&signatureHeader.length<=2048,'Stripe signature missing');
 must(typeof secret==='string'&&secret.length>=24,'Webhook secret not configured');
 const entries=signatureHeader.split(',').map(x=>x.trim().split('='));
 const stamp=entries.find(([k])=>k==='t')?.[1];
 const signatures=entries.filter(([k,v])=>k==='v1'&&/^[a-f0-9]{64}$/i.test(v||'')).map(x=>x[1]);
 must(stamp&&/^\d{10,13}$/.test(stamp)&&signatures.length>0,'Invalid Stripe signature');
 const t=Number(stamp);
 must(Number.isSafeInteger(t)&&Math.abs(nowSeconds-t)<=300,'Webhook timestamp outside five-minute tolerance');
 const expected=createHmac('sha256',secret).update(stamp+'.'+rawBody).digest();
 const verified=signatures.some(sig=>timingSafeEqual(expected,Buffer.from(sig,'hex')));
 must(verified,'Webhook signature invalid');
 const event=JSON.parse(rawBody);
 must(boundString(event?.id,120)&&boundString(event?.type,100)&&event?.data&&typeof event.data.object==='object','Invalid Stripe event shape');
 return event;
}
/** Payment is credited only if a signed, expected, complete provider session matches this order. */
function applyVerifiedPaymentEvent(order,event,{now=new Date().toISOString()}={}){
 must(order?.state==='pending_payment'||order?.state==='paid_pending_fulfillment','Payment event not expected');
 must(event&&SUPPORTED.includes(event.type),'Unsupported or incomplete payment event');
 must(boundString(event.id,120),'Invalid event id');
 if(order.processed_events.includes(event.id))return Object.freeze({...order}); // exact duplicate harmless
 must(order.state==='pending_payment','Different payment event after payment settled');
 const obj=event?.data?.object;
 must(obj&&obj.object==='checkout.session','Expected Checkout Session');
 must(obj.id===order.session_id&&obj.client_reference_id===order.id,'Order/session binding mismatch');
 must(obj.currency===order.currency&&obj.amount_total===order.amount_cents,'Payment amount/currency mismatch');
 must(obj.payment_status==='paid'&&obj.status==='complete','Payment not complete');
 return Object.freeze({...order,state:'paid_pending_fulfillment',payment_event_id:event.id,
   processed_events:[...order.processed_events,event.id],updated_at:now});
}
export function acceptSignedStripeWebhook(order,{rawBody,signatureHeader,secret,nowSeconds,now}={}){
 const event=verifyStripeWebhook({rawBody,signatureHeader,secret,nowSeconds});
 return applyVerifiedPaymentEvent(order,event,{now});
}
export function beginFulfillment(order,{now=new Date().toISOString()}={}){
 must(order?.state==='paid_pending_fulfillment','Paid provider receipt required before fulfillment');
 return Object.freeze({...order,state:'generating',updated_at:now});
}
export function completeDraftReport(order,input,{now=new Date().toISOString()}={}){
 must(order?.state==='generating','Fulfillment not initiated');
 const result=analyzeCommercialTool(order.tool_id,input);
 must(order.input_digest==='sha256:'+digest(input),'Report inputs do not match quoted purchase');
 const report=buildReport({type:result.report_type,title:result.tool_name+' — customized report draft',
  company:'Customer report (identity held privately)',period:'One-off assessment',
  metrics:result.calculated_metrics,findings:result.findings,
  recommendations:result.proposed_actions,data_status:'caller-supplied'});
 const output=exportArtifact(report,'json');
 const reportHash='sha256:'+createHash('sha256').update(output.content).digest('hex');
 return {order:Object.freeze({...order,state:'awaiting_review',report_digest:reportHash,
    report_status:'unverified-draft',qa_accepted:false,source_verified:false,updated_at:now}),
   report,artifact:output};
}
export function approveDraftForDelivery(order,{reviewer,reportDigest,now=new Date().toISOString()}={}){
 must(order?.state==='awaiting_review','Report not awaiting review');
 must(safeId(reviewer?.subject_id)&&safeId(reviewer?.tenant_id)&&reviewer.tenant_id===order.tenant_id,'Independent authenticated reviewer required');
 must(reviewer.subject_id!==order.subject_id,'Customer cannot independently review own report');
 must(reviewer.role==='reviewer','Reviewer permission required');
 must(reportDigest===order.report_digest,'Reviewed artifact digest mismatch');
 return Object.freeze({...order,state:'approved_for_delivery',qa_accepted:true,
   report_status:'reviewed-unverified-source',updated_at:now});
}
export function markPrivateDelivery(order,{privateRef,now=new Date().toISOString()}={}){
 must(order?.state==='approved_for_delivery','Quality review required');
 must(typeof privateRef==='string'&&/^[a-z0-9-]+\/[a-zA-Z0-9/_-]{4,200}$/.test(privateRef)
   &&!privateRef.includes('..'),'Private object reference required');
 return Object.freeze({...order,state:'delivered',delivery_ref:privateRef,updated_at:now});
}
export function entitlement(order,identity){
 assertOwner(order,identity);
 if(order.state!=='delivered'||!order.delivery_ref)return {accessible:false,reason:'Not delivered'};
 return {accessible:true,private_ref:order.delivery_ref,status:order.report_status,
   warning:'Source evidence not independently verified. Access must be issued by authenticated delivery gateway.'};
}
export function publicOrderStatus(order,identity){
 assertOwner(order,identity);
 return {id:order.id,tool_id:order.tool_id,state:order.state,report_status:order.report_status,
  amount_cents:order.amount_cents,currency:order.currency,source_verified:order.source_verified,
  qa_accepted:order.qa_accepted,delivery_available:order.state==='delivered'};
}
