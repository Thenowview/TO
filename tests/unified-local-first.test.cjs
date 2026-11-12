"use strict";
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=name=>fs.readFileSync(path.join(root,name),'utf8');
const html=read('offline_desktop/static/index.html');
const app=read('offline_desktop/static/app.js');
const api=read('offline_desktop/app.py');
const knowledge=read('offline_desktop/engine/reviewed_knowledge.py');
test('One operating desk displays actual local work and preview-only routes',()=>{
  for(const id of ['operatingRefresh','operatingStatus','operatingInstruction','operatingRoute','operatingRouteResult'])
    assert.ok(html.includes('id="'+id+'"'),id);
  assert.ok(api.includes("'/api/operating/overview'"));
  assert.ok(api.includes("'/api/operating/route'"));
  assert.ok(app.includes('function loadOperatingDesk'));
  assert.ok(app.includes('function routeOperatingInstruction'));
  assert.ok(app.includes('No task queued or tool executed'));
});
test('Knowledge import requires consent and cannot inherit review status',()=>{
  for(const id of ['knowledgeRefresh','knowledgeCandidates','knowledgeExport','knowledgeImportFile',
                   'knowledgeImport','knowledgeTransferStatus'])
    assert.ok(html.includes('id="'+id+'"'),id);
  for(const endpoint of ['/api/adaptive/knowledge/validate','/api/adaptive/knowledge/import',
                         '/api/adaptive/knowledge/export'])
    assert.ok(api.includes(endpoint),endpoint);
  assert.ok(knowledge.includes("'candidate'"));
  assert.ok(knowledge.includes('review_required'));
  assert.ok(app.includes('loadKnowledgeCandidates()'));
  assert.ok(!app.includes('innerHTML='));
});
