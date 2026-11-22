#!/usr/bin/env node
/** Read-only legacy name inventory; no repository files are modified. */
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
const root = process.cwd();
const json = process.argv.includes('--json');
const failOnReview = process.argv.includes('--fail-on-review');
const ignored = new Set(['.git','node_modules','.next','dist','build','coverage','.venv','venv','out','.turbo','.cache','.pnpm-store']);
const binary = /\.(?:png|jpe?g|gif|webp|ico|pdf|zip|gz|tgz|7z|exe|dll|so|dylib|woff2?|ttf|otf|mp4|mov|lock|map|snap|sqlite|db|bin|wasm)$/i;
const legacy = /theorgnet|theorg|theepmotest|faisalwrokksa-hub\/TO|\b(?:gaiz ai|gaiz|orgnzion|orggize|stratgize|\.gaze)\b|\.gaiz\b/gi;
const matches = [], errors = [];
function classify(file,line) {
  if (/^(?:legacy|archive|archives|migration|migrations)\//i.test(file) || /(?:^|\/)(?:CHANGELOG|HISTORY|RELEASE_AUDIT)[^/]*$/i.test(file)) return 'historical';
  if (/GAIZ[12]|\.gaiz\b|(?:legacy|compatib|protocol|signed|historical|wire[- ]format)/i.test(line)) return 'compatibility-or-history';
  if (/^(?:docs\/|README|AGENTS\.md)/i.test(file)) return 'documentation-review';
  return 'active-file-review';
}
async function walk(dir) {
  let entries;
  try { entries = await readdir(dir,{withFileTypes:true}); }
  catch(e) { errors.push({path:path.relative(root,dir),error:e.code||String(e)}); return; }
  for(const entry of entries) {
    if(entry.isSymbolicLink()) continue;
    const abs=path.join(dir,entry.name);
    if(entry.isDirectory()){if(!ignored.has(entry.name)) await walk(abs);continue;}
    if(!entry.isFile()||binary.test(entry.name)) continue;
    let size; try {size=(await stat(abs)).size;} catch {continue;}
    if(size>1024*1024) continue;
    let content;try{content=await readFile(abs,'utf8');}catch{continue;}
    if(content.includes('\u0000')) continue;
    const file=path.relative(root,abs).replaceAll(path.sep,'/');
    if(file==='scripts/audit-legacy-branding.mjs') continue; // Do not count the scanner's own patterns.
    for(const [index,line] of content.split(/\r?\n/).entries()){
      legacy.lastIndex=0;
      const tokens=[...new Set([...line.matchAll(legacy)].map(x=>x[0]))];
      if(tokens.length) matches.push({path:file,line:index+1,classification:classify(file,line),tokens});
    }
  }
}
await walk(root);
const counts=matches.reduce((a,x)=>(a[x.classification]=(a[x.classification]||0)+1,a),{});
if(json) console.log(JSON.stringify({root,scannedAt:new Date().toISOString(),matches:matches.length,counts,findings:matches,readErrors:errors},null,2));
else {
  console.log('Legacy naming matches: '+matches.length);
  for(const [k,v] of Object.entries(counts)) console.log('  '+k+': '+v);
  for(const m of matches) console.log(m.path+':'+m.line+' ['+m.classification+'] '+m.tokens.join(', '));
  if(errors.length) console.error('Unreadable directories: '+errors.length);
}
if(failOnReview && matches.some(x=>x.classification==='active-file-review')) process.exitCode=1;
