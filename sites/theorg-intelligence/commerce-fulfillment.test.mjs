import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {exampleForTool} from './commercial-tools.mjs';
import {quoteReport,createDraftOrder,assertOwner,attachProviderSession,verifyStripeWebhook,
 acceptSignedStripeWebhook,beginFulfillment,completeDraftReport,approveDraftForDelivery,
 markPrivateDelivery,entitlement,publicOrderStatus,COMMERCE_MODES} from './commerce-fulfillment.mjs';

const customer={tenant_id:'company_a',subject_id:'buyer1'};
const outsider={tenant_id:'company_b',subject_id:'buyer1'};
const reviewer={tenant_id:'company_a',subject_id:'reviewer1',role:'reviewer'};
const secret='whsec_synthetic_0123456789_0123456789';
const orderId='ord_example_0001';
const checkoutId='cs_test_123456789000';
const stamp=1784123456;
const sample=exampleForTool('project-health');
function draft(){
 const quote=quoteReport('project-health',sample);
 return createDraftOrder({quote,identity:customer,id:orderId,now:'2026-11-13T00:00:00.000Z'});
}
function event({type='checkout.session.completed',status='paid',session=checkoutId,amount=1900,currency='usd',reference=orderId,id='evt_sample_1'}={}){
 return {id,type,data:{object:{object:'checkout.session',id:session,status:'complete',
  client_reference_id:reference,amount_total:amount,currency,payment_status:status}}};
}
function signed(ev=event(),{timestamp=stamp,secretKey=secret}={}){
 const rawBody=JSON.stringify(ev);
 const signature=createHmac('sha256',secretKey).update(timestamp+'.'+rawBody).digest('hex');
 return {rawBody,signatureHeader:'t='+timestamp+',v1='+signature,secret,nowSeconds:stamp};
}
function pending(){return attachProviderSession(draft(),checkoutId);}
function paid(){
 const order=pending();
 return acceptSignedStripeWebhook(order,signed());
}
test('server quotes prices from catalog, not client input',()=>{
 const q=quoteReport('project-health',sample);
 assert.equal(q.amount_cents,1900);
 assert.equal(q.currency,'usd');
 assert.equal(q.checkout_enabled,false);
 assert.equal(createDraftOrder({quote:q,identity:customer,id:orderId}).state,'draft');
 assert.throws(()=>createDraftOrder({quote:{...q,amount_cents:1},identity:customer,id:orderId}));
 assert.throws(()=>createDraftOrder({quote:q,identity:{tenant_id:customer.tenant_id},id:orderId}));
});
test('public orders disclose no customer report content',()=>{
 const x=publicOrderStatus(draft(),customer);
 assert.equal(x.state,'draft');
 assert.equal(x.delivery_available,false);
 assert.ok(!('delivery_ref'in x));
 assert.throws(()=>publicOrderStatus(draft(),outsider));
 assert.throws(()=>entitlement(draft(),outsider));
});
test('cannot begin generation from draft or unpaid checkout',()=>{
 assert.throws(()=>beginFulfillment(draft()));
 assert.throws(()=>beginFulfillment(pending()));
 assert.throws(()=>completeDraftReport(draft(),sample));
 assert.throws(()=>approveDraftForDelivery(draft(),{reviewer,reportDigest:'anything'}));
});
test('webhook payload must be signed with fresh raw body',()=>{
 const valid=signed();
 assert.equal(verifyStripeWebhook(valid).type,'checkout.session.completed');
 assert.throws(()=>verifyStripeWebhook({...valid,rawBody:valid.rawBody+' '}));
 assert.throws(()=>verifyStripeWebhook({...valid,signatureHeader:'t='+stamp+',v1='+'f'.repeat(64)}));
 assert.throws(()=>verifyStripeWebhook({...valid,nowSeconds:stamp+301}));
 assert.throws(()=>verifyStripeWebhook({...valid,signatureHeader:'t=x,v1=abc'}));
 assert.throws(()=>verifyStripeWebhook({...valid,secret:'short'}));
 assert.throws(()=>acceptSignedStripeWebhook(pending(),{rawBody:JSON.stringify(event()),signatureHeader:'',secret,nowSeconds:stamp}));
});
test('signed but mismatched amount, currency, session, order ID or unpaid state never settles',()=>{
 const cases=[{amount:1},{currency:'sar'},{session:'cs_test_111111111'},{reference:'ord_else_8888'},{status:'unpaid'},
  {type:'checkout.session.expired'}];
 for(const param of cases){
  assert.throws(()=>acceptSignedStripeWebhook(pending(),signed(event(param))),JSON.stringify(param));
 }
});
test('paid webhook can be retried without issuing a second payment',()=>{
 const x=paid();
 assert.equal(x.state,'paid_pending_fulfillment');
 assert.equal(x.payment_event_id,'evt_sample_1');
 const retried=acceptSignedStripeWebhook(x,signed());
 assert.equal(retried.state,'paid_pending_fulfillment');
 assert.equal(retried.processed_events.length,1);
 assert.throws(()=>acceptSignedStripeWebhook(x,signed(event({id:'evt_another_2'}))));
});
test('signed async success allowed, pending status not allowed',()=>{
 const x=acceptSignedStripeWebhook(pending(),signed(event({type:'checkout.session.async_payment_succeeded'})));
 assert.equal(x.state,'paid_pending_fulfillment');
 assert.throws(()=>acceptSignedStripeWebhook(pending(),signed(event({type:'checkout.session.completed',status:'unpaid'}))));
});
test('end-to-end paid fulfillment is review gated and evidence remains unverified',()=>{
 const started=beginFulfillment(paid());
 const {order,artifact,report}=completeDraftReport(started,sample);
 assert.equal(order.state,'awaiting_review');
 assert.equal(report.status,'caller-supplied');
 assert.equal(order.source_verified,false);
 assert.equal(order.qa_accepted,false);
 assert.equal(artifact.mime,'application/json');
 assert.throws(()=>markPrivateDelivery(order,{privateRef:'company_a/orders/ord_example_0001/reports/r_1234'}));
 assert.throws(()=>approveDraftForDelivery(order,{reviewer:customer,reportDigest:order.report_digest}));
 assert.throws(()=>approveDraftForDelivery(order,{reviewer,reportDigest:'sha256:'+'0'.repeat(64)}));
 const reviewed=approveDraftForDelivery(order,{reviewer,reportDigest:order.report_digest});
 assert.equal(reviewed.state,'approved_for_delivery');
 const delivered=markPrivateDelivery(reviewed,{privateRef:'company_a/orders/ord_example_0001/reports/report-0001'});
 assert.equal(delivered.state,'delivered');
 const e=entitlement(delivered,customer);
 assert.equal(e.accessible,true);
 assert.equal(e.requires_authenticated_delivery,true);
 assert.equal('private_ref' in e,false);
 assert.throws(()=>markPrivateDelivery(reviewed,{privateRef:'company_b/orders/ord_example_0001/reports/report-0001'}));
 assert.match(e.status,/unverified-source/);
 assert.throws(()=>entitlement(delivered,outsider));
 assert.throws(()=>markPrivateDelivery(reviewed,{privateRef:'https://external.example/download'}));
});
test('refund and cancellation are not simulated as fulfilled purchases',()=>{
 assert.equal(COMMERCE_MODES.payment,'provider-not-connected');
 assert.throws(()=>acceptSignedStripeWebhook(pending(),signed(event({type:'charge.refunded'}))));
 assert.throws(()=>attachProviderSession(draft(),'http://fake.example'));
});
test('report payloads are bound to quoted source inputs',()=>{
 const order=beginFulfillment(paid());
 const edited={...sample,delivery:1};
 assert.throws(()=>completeDraftReport(order,edited));
});
