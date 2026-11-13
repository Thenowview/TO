'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('Local web page shows credential-free integration catalog through authenticated API',()=>{
 const html=read('offline_desktop/static/index.html');
 const js=read('offline_desktop/static/app.js');
 const api=read('offline_desktop/app.py');
 for(const id of ['websiteIntegrationsRefresh','websiteIntegrationList','websiteIntegrationStatus','websiteReleaseStatus'])
   assert.ok(html.includes('id="'+id+'"'),id);
 assert.ok(js.includes("request('website/integrations')"));
 assert.ok(js.includes("loadWebsiteIntegrations().catch"));
 assert.ok(js.includes('rel=\'noopener noreferrer\''));
 assert.ok(api.includes("path=='/api/website/integrations'"));
 assert.ok(api.includes("if not self._auth():return"));
});
test('Website catalog distinguishes external The Org from this local project',()=>{
 const c=read('offline_desktop/engine/website_integrations.py');
 assert.ok(c.includes('The Org (separate company)'));
 assert.ok(c.includes('not_implemented'));
 assert.ok(c.includes('potentially_metered'));
 assert.ok(c.includes('external_calls_made'));
});
