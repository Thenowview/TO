#!/usr/bin/env node
// Local operator-controlled GAIZ2 export/verify/open. Never accepts secret keys via CLI arguments.
import {readFileSync,writeFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createGaiz2,verifyGaiz2,openGaiz2} from './v2.mjs';
import {validateGovernanceReport} from './report.mjs';
function option(n) {const i=process.argv.indexOf(n);return i<0?null:process.argv[i+1];}
function required(n) {const v=option(n);if(!v || v.startsWith('--'))throw Error(n+' required');return v;}
function keyfile(n) {return readFileSync(resolve(required(n)),'utf8');}
function policy(){return {trustedIssuerPublicKey:keyfile('--trusted-issuer-public'),expectedIssuerId:required('--issuer'),expectedTenantScope:required('--tenant')};}
try {
 const action=process.argv[2];
 if(action==='export') {
  if(!process.argv.includes('--confirm-local-export'))throw Error('Explicit --confirm-local-export required');
  const report=validateGovernanceReport(JSON.parse(readFileSync(resolve(required('--report')),'utf8')));
  const manifest={version:2,schemaVersion:1,artifactId:required('--artifact-id'),issuerId:required('--issuer'),tenantScope:required('--tenant'),contentType:'application/vnd.orgaiz.report+json',createdAt:new Date().toISOString()};
  const bytes=createGaiz2({report,manifest,recipients:[{keyId:required('--recipient-id'),publicKey:keyfile('--recipient-public')}],issuerPrivateKey:keyfile('--issuer-private')});
  writeFileSync(resolve(required('--output')),bytes,{flag:'wx',mode:0o600});
  process.stdout.write(JSON.stringify({status:'created',path:required('--output'),bytes:bytes.length})+'\n');
 } else if(action==='verify') {
  const receipt=verifyGaiz2(readFileSync(resolve(required('--input'))),policy()).receipt;
  process.stdout.write(JSON.stringify(receipt)+'\n');
 } else if(action==='open') {
  if(!process.argv.includes('--confirm-local-open'))throw Error('Explicit --confirm-local-open required');
  const result=openGaiz2(readFileSync(resolve(required('--input'))),{...policy(),recipientKeyId:required('--recipient-id'),recipientPrivateKey:keyfile('--recipient-private')});
  // Never print plaintext reports to terminal or untrusted logs.
  writeFileSync(resolve(required('--output')),JSON.stringify(result.report,null,2)+'\n',{flag:'wx',mode:0o600});
  process.stdout.write(JSON.stringify({status:'opened',path:required('--output'),receipt:result.verification})+'\n');
 } else {throw Error('Usage: node gaiz/cli.mjs export|verify|open --... (see gaiz/README.md)');}
} catch(error) {process.stderr.write('GIZE AI legacy artifact operation denied: '+error.message+'\n');process.exitCode=1;}
