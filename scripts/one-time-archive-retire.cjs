'use strict';
// One-time branch retirement. Every deleted branch has a verified, recoverable
// Git tag pointing to its exact original commit SHA. This does NOT merge code.
module.exports = async function archiveRetire({github, context, core}) {
  const {owner,repo} = context.repo;
  const report={repository:owner+'/'+repo,head:context.sha,archived:[],skipped:[],errors:[]};
  const branches=await github.paginate(github.rest.repos.listBranches,{owner,repo,per_page:100});
  const main=await github.rest.repos.getBranch({owner,repo,branch:'main'});
  if(main.data.commit.sha!==context.sha)throw Error('Main advanced; fail closed and review a new cleanup run');
  for(const branch of branches){
    const name=branch.name;
    if(name==='main'||branch.protected){report.skipped.push({name,reason:'main or protected'});continue;}
    try{
      const prs=await github.rest.pulls.list({owner,repo,state:'open',head:owner+':'+name,per_page:1});
      if(prs.data.length){report.skipped.push({name,reason:'open PR'});continue;}
      const current=await github.rest.repos.getBranch({owner,repo,branch:name});
      if(current.data.protected||current.data.commit.sha!==branch.commit.sha){
        report.skipped.push({name,reason:'protected or moving branch'});continue;
      }
      const ref='tags/branch-archive/20261118/'+name;
      let old;
      try{
        old=(await github.rest.git.getRef({owner,repo,ref})).data;
      }catch(error){
        if(error.status!==404)throw error;
        await github.rest.git.createRef({owner,repo,ref:'refs/'+ref,sha:branch.commit.sha});
      }
      if(old&&old.object.sha!==branch.commit.sha)throw Error('Archive tag collision; branch not deleted');
      const verified=(await github.rest.git.getRef({owner,repo,ref})).data;
      if(verified.object.type!=='commit'||verified.object.sha!==branch.commit.sha)
        throw Error('Archive reference verification mismatch');
      const fresh=await github.rest.repos.getBranch({owner,repo,branch:name});
      if(fresh.data.protected||fresh.data.commit.sha!==branch.commit.sha){
        report.skipped.push({name,reason:'branch changed after archive'});continue;
      }
      const check=await github.rest.pulls.list({owner,repo,state:'open',head:owner+':'+name,per_page:1});
      if(check.data.length){report.skipped.push({name,reason:'new open PR'});continue;}
      await github.rest.git.deleteRef({owner,repo,ref:'heads/'+name});
      report.archived.push({name,sha:branch.commit.sha,tag:'refs/'+ref,integratedIntoMain:'not asserted'});
    }catch(error){
      report.errors.push({name,error:String(error.message||error)});
    }
  }
  const fs=require('node:fs');
  fs.writeFileSync('branch-retirement-report.json',JSON.stringify(report,null,2)+'\n');
  core.info(JSON.stringify({archived:report.archived.length,skipped:report.skipped.length,errors:report.errors.length}));
  await core.summary.addHeading('One-time archived branch retirement')
    .addRaw('Archived and retired: '+report.archived.length+'; skipped: '+report.skipped.length+
      '; errors: '+report.errors.length+'. Tags preserve exact commits; unmerged changes are NOT integrated into main.')
    .write();
  if(report.errors.length)core.setFailed('Some branch archivals failed; review retained branches and evidence.');
};
