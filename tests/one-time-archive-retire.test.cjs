'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const retire = require('../scripts/one-time-archive-retire.cjs');

function fixture({tagSha=null,moving=false,open=false}={}) {
  const calls=[];
  const github={
    paginate:async()=>[{name:'main',protected:true,commit:{sha:'MAIN'}},{name:'old/branch',protected:false,commit:{sha:'OLD'}}],
    rest:{
      repos:{
        listBranches:()=>{},
        getBranch:async({branch})=>({data:{protected:branch==='main',commit:{sha:branch==='main'?'MAIN':moving?'CHANGED':'OLD'}}})
      },
      pulls:{list:async()=>({data:open?[{}]:[]})},
      git:{
        getRef:async()=>{if(tagSha===null){const e=new Error('not found');e.status=404;throw e;}return {data:{object:{type:'commit',sha:tagSha}}};},
        createRef:async({ref,sha})=>{calls.push(['tag',ref,sha]);tagSha=sha;},
        deleteRef:async({ref})=>{calls.push(['delete',ref]);}
      }
    }
  };
  return {github,calls,core:{info:()=>{},setFailed:()=>{},summary:{addHeading(){return this;},addRaw(){return this;},write:async()=>{}}}};
}
test('archive verifies exact original SHA before deleting branch',async()=>{
  const a=fixture();
  try{
    await retire({github:a.github,context:{repo:{owner:'org',repo:'repo'},sha:'MAIN'},core:a.core});
    assert.deepEqual(a.calls,[['tag','refs/tags/branch-archive/20261118/old/branch','OLD'],['delete','heads/old/branch']]);
    const report=JSON.parse(fs.readFileSync('branch-retirement-report.json','utf8'));
    assert.equal(report.archived[0].integratedIntoMain,'not asserted');
  }finally{fs.rmSync('branch-retirement-report.json',{force:true});}
});
test('archive refuses deletion on existing tag collision',async()=>{
  const a=fixture({tagSha:'OTHER'});
  try{
    await retire({github:a.github,context:{repo:{owner:'org',repo:'repo'},sha:'MAIN'},core:a.core});
    assert.equal(a.calls.some(c=>c[0]==='delete'),false);
    assert.equal(JSON.parse(fs.readFileSync('branch-retirement-report.json')).errors.length,1);
  }finally{fs.rmSync('branch-retirement-report.json',{force:true});}
});
test('archive does not delete branches with open PRs or changed heads',async()=>{
  for(const cfg of [{open:true},{moving:true}]){
    const a=fixture(cfg);
    try{await retire({github:a.github,context:{repo:{owner:'org',repo:'repo'},sha:'MAIN'},core:a.core});
      assert.equal(a.calls.some(c=>c[0]==='delete'),false);
    }finally{fs.rmSync('branch-retirement-report.json',{force:true});}
  }
});
