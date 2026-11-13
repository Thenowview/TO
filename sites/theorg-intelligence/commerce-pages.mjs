// Transparent public information pages, with explicit legal and seller-review gates.
// Source only: these are DRAFTS, not approved legal notices or commercial terms.
import {COMMERCIAL_TOOLS,analyzeCommercialTool,exampleForTool} from './commercial-tools.mjs';
const html=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const sections=(items)=>items.map(([heading,body])=>'<section><h2>'+html(heading)+'</h2><p>'+html(body)+'</p></section>').join('');
const POLICY_DRAFTS=Object.freeze({
 privacy:{
  title:'Privacy and Data Handling — Draft',
  intro:'This is a pre-launch transparency draft. It is not the final privacy notice or a promise of production data handling.',
  items:[
   ['Current public preview','Free calculator inputs are processed by first-party browser JavaScript. The preview does not transmit these form values to a TheOrg application server. Avoid entering confidential, personal or regulated data in a public preview.'],
   ['No customer accounts or purchases','The preview has no live signup, checkout, payment collection, document upload or paid storage service. It cannot accept real orders.'],
   ['Prospective paid product','Before launch, an accountable business owner must define the legal seller, contact channel, lawful basis, permitted processing purposes, data retention, deletion, cross-border processing, subprocessors, analytics consent and customer rights.'],
   ['Future AI processing','The selected model and provider, location of processing, data sharing terms, security safeguards and retention must be disclosed before any customer document or personal data is transmitted.'],
   ['Website analytics and cookies','No marketing analytics is intentionally bundled with this demonstration. Browser behavior, CDN/server telemetry and platform logs still require verification before final policy approval.'],
   ['Your rights and requests','Contact details, response process, and jurisdiction-specific consumer/privacy rights remain to be finalized by the legal seller. Do not rely on this draft as a formal request channel.']
  ]
 },
 terms:{
  title:'Terms of Service — Draft',
  intro:'TheOrg has not opened commercial orders. These draft terms are informational, not the final contract with customers.',
  items:[
   ['Service description','The existing preview produces deterministic calculations or structured drafts from inputs provided by the user. It does not provide verified professional, legal, accounting or investment advice.'],
   ['Report methodology','Scores and scenarios are illustrative and depend on the accuracy of submitted data. No external verification, independent QA or trained expert review is performed by the public preview.'],
   ['Accounts and payments','No commercial subscription, paid report entitlement, customer profile or order is available in this preview. Proposed prices are hypotheses, not accepted offers.'],
   ['Acceptable input','Users should not submit secrets, production credentials, confidential records or personal data to the public preview.'],
   ['Future licensed terms','Before first sale, complete provider identification, service commitments, intellectual-property/licensing rights, limitations, liability, governing law, dispute resolution, support and termination terms.']
  ]
 },
 refunds:{
  title:'Refund and Fulfillment Policy — Draft',
  intro:'No payments are being accepted and no paid fulfillment is active. This page is a launch planning disclosure, not a current refund offer.',
  items:[
   ['Current state','Checkout, invoices, subscriptions, payment webhooks, refund execution and automatic report delivery are disabled. No order confirmation can be issued.'],
   ['Before paid launch','The seller must publish exact cancellation/refund eligibility, delivery expectations, report revision rules, failed report remediation, dispute and support contact, and applicable consumer rights.'],
   ['Report acceptance','A report should not be delivered on a payment success-page redirect alone. Confirm payment securely through the provider, generate the report, perform QA and issue a private authorized download.'],
   ['Customer support','A real customer support contact and published response window must be approved and staffed before first paid launch.']
  ]
 }
});
export function policyKeys(){return Object.keys(POLICY_DRAFTS)}
function pageShell(title,body){
 return '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+html(title)+' | TheOrg Preview</title>'+
 '<style>body{margin:0;background:#081827;color:#f0f7f8;font:15px/1.65 system-ui,sans-serif}main{max-width:890px;margin:auto;padding:45px 24px 85px}header{background:#0e2b3b;padding:18px 24px;border-bottom:1px solid #31586a}header a{color:#6be4cf;text-decoration:none;font-weight:800}h1{font-size:clamp(29px,5vw,44px);line-height:1.14}h2{font-size:19px;color:#6be4cf;margin-top:30px}p{color:#ccdde3}a{color:#78ecd9}.warning{padding:15px;border-left:4px solid #e9bd82;background:#473a31;border-radius:7px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px}.card{border:1px solid #315467;border-radius:12px;padding:18px;background:#102a3a}small{color:#b9d0da}</style>'+
 '<header><a href="/">TheOrg — Commercial preview</a></header><main>'+body+
 '<hr style="border:0;border-top:1px solid #385365;margin:32px 0"><p><a href="/privacy">Privacy draft</a> · <a href="/terms">Terms draft</a> · <a href="/refunds">Refund draft</a> · <a href="/sample-reports">Sample reports</a></p>'+
 '<small>Public development preview. No payment, signup or live AI is enabled.</small></main></html>';
}
export function renderPolicyPage(name){
 const item=POLICY_DRAFTS[name];if(!item)return null;
 return pageShell(item.title,'<h1>'+html(item.title)+'</h1><p class="warning">'+html(item.intro)+'</p>'+sections(item.items));
}
export const EXAMPLE_REPORT_TOOLS=Object.freeze(['project-health','kpi-analyzer','risk-assessment','pmo-maturity','decision-brief']);
export function renderSampleReports(){
 const cards=EXAMPLE_REPORT_TOOLS.map(id=>{
  const tool=COMMERCIAL_TOOLS.find(t=>t.id===id);
  const result=analyzeCommercialTool(id,exampleForTool(id));
  const metric=Object.entries(result.calculated_metrics).slice(0,3).map(([k,v])=>'<p><b>'+html(k.replaceAll('_',' '))+':</b> '+html(v)+'</p>').join('');
  return '<article class="card"><h2>'+html(tool.name)+'</h2><small>All values are synthetic / illustrative.</small>'+metric+
   '<p><b>Example finding:</b> '+html(result.findings[0])+'</p><p><a href="/tools/'+html(id)+'">Try this assessment</a></p></article>';
 }).join('');
 return pageShell('Five clearly labeled report examples','<h1>Example business reports</h1>'+
 '<p class="warning">Illustrative examples only. These are not customer reports, AI research, evidence-backed assurance or paid deliverables.</p>'+
 '<div class="grid">'+cards+'</div><p>Each example uses hard-coded public demonstration inputs. Your own assessment is calculated inside your browser.</p>');
}
export function renderHowItWorks(){
 return pageShell('How TheOrg works','<h1>How TheOrg works</h1><div class="grid">'+[
 ['1. Choose a Quick Win','Select an assessment, understand the fields and use sample or non-sensitive input. Basic calculations do not require an account.'],
 ['2. Review a transparent result','See the assumptions, scores, draft report and proposed next steps. You can inspect the data limits before exporting.'],
 ['3. Choose whether to continue','Download your illustrative draft. TheOrg paid reports, private workspaces and recurring intelligence are planned, not active.'],
 ['4. Keep projects progressing','If a project needs ongoing governance, you may independently explore THEEPMO. No data or account is transferred automatically.']
 ].map(([a,b])=>'<section class="card"><h2>'+html(a)+'</h2><p>'+html(b)+'</p></section>').join('')+'</div>');
}
export function renderDisabledAccount(){
 return pageShell('Customer reports — not active','<h1>My reports</h1><p class="warning">Customer accounts and private report downloads are not active in this commercial preview. No signup, login, file upload or purchase is possible.</p><p>You can use the free assessments without creating an account. Please do not send sensitive business files to a public preview.</p><p><a href="/">Return to free tools</a></p>');
}
