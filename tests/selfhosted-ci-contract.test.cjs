"use strict";
// Review-only contract tests: they guard the $0 Actions policy, not runtime success.
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ROOT=path.resolve(__dirname,"..");
const workflows=[
  "bridge-ci.yml",
  "one-time-prune-merged-branches.yml",
  "chromium-browser-ci.yml",
  "onefile-existing-chrome-ci.yml",
  "portable-chrome-ci.yml",
  "theorg-supervisor-source-preview.yml",
  "theorg-v010-portable-exe.yml",
  "theorg-full-oneapp-windows.yml"
];
for(const name of workflows){
  test("No GitHub-hosted compute, automatic PR execution or uploaded artifacts: "+name,()=>{
    const source=fs.readFileSync(path.join(ROOT,".github","workflows",name),"utf8");
    assert.match(source,/^on:\s*\n\s{2}workflow_dispatch:/m);
    assert.doesNotMatch(source,/^\s{2}(?:pull_request|push|schedule):/m);
    assert.match(source,/confirm_self_hosted:/);
    assert.match(source,/confirm_self_hosted:[\s\S]*?default:\s*false/);
    const jobs=source.slice(source.indexOf("\njobs:\n"));
    const names=(jobs.match(/^\s{2}[a-zA-Z0-9_-]+:\s*$/gm)||[]);
    assert.ok(names.length>=1,"Expected at least one job");
    const guards=jobs.match(/^\s{4}if: .*github\.actor == github\.repository_owner.*inputs\.confirm_self_hosted/gm)||[];
    assert.equal(guards.length,names.length,"Every runnable job must require manual owner approval");
    const runs=jobs.match(/^\s{4}runs-on:.*$/gm)||[];
    assert.equal(runs.length,names.length,"Every job must target a runner");
    for(const run of runs){
      assert.match(run,/\[self-hosted, windows, x64, theorg-win\]/);
    }
    assert.doesNotMatch(source,/\bruns-on:\s*(?:ubuntu|windows)-(?:latest|20\d\d)\b/);
    assert.match(source,/\bcontents:\s*read/);
    const checkouts=source.split("uses: actions/checkout@v4").slice(1);
    for(const following of checkouts){
      assert.match(following.slice(0,120),/persist-credentials:\s*false/);
    }
    const uploadSteps=source.split("uses: actions/upload-artifact@v4");
    for(let i=1;i<uploadSteps.length;i++){
      const lines=uploadSteps[i-1].split("\n");
      const lastStep=lines.slice(Math.max(0,lines.length-5)).join("\n");
      const nextLines=uploadSteps[i].split("\n").slice(0,3).join("\n");
      assert.match(lastStep+"\n"+nextLines,/if:\s*\$\{\{ false \}\}/,
        "Uploads must be explicitly disabled under the zero-budget policy");
    }
  });
}
test("Production release policy remains fail closed",()=>{
  const policy=JSON.parse(fs.readFileSync(path.join(ROOT,"config","release-gates.json"),"utf8"));
  assert.equal(policy.productionReady,false);
  assert.equal(policy.decision,"NO_GO");
});

test("Bridge runner preflight executes before any source or Windows build",()=>{
  const workflow=fs.readFileSync(path.join(ROOT,".github","workflows","bridge-ci.yml"),"utf8");
  const preflight=workflow.indexOf("./tools/Test-TheOrg-Runner-Preflight.ps1");
  const source=workflow.indexOf("./tools/Test-TheOrg-Source-Local.ps1");
  const build=workflow.indexOf("./tools/Build-TheOrg-Windows-Local.ps1");
  assert.ok(preflight>0 && source>preflight && build>source);
  assert.match(workflow,/build_unsigned_windows_candidate:/);
  assert.match(workflow,/build_unsigned_windows_candidate:[\s\S]*?default:\s*false/);
});
test("Runner launch needs explicit consent and registration; scripts never create tokens",()=>{
  const setup=fs.readFileSync(path.join(ROOT,"tools","Test-TheOrg-Runner-Preflight.ps1"),"utf8");
  const launch=fs.readFileSync(path.join(ROOT,"tools","Start-TheOrg-SelfHosted-Runner.ps1"),"utf8");
  assert.match(launch,/\[switch\]\$ConfirmStart/);
  assert.match(launch,/if\(-not \$ConfirmStart\)/);
  assert.match(launch,/-RequireRunnerRegistration/);
  assert.match(setup,/\.runner/);
  assert.match(setup,/Python 3\.12\+/);
  assert.match(setup,/Node\.js 20\+/);
  assert.doesNotMatch(launch+setup,/registration.token|api\.github\.com.*registration-token|ConvertFrom-SecureString/i);
});
