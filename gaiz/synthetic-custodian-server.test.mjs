import test from 'node:test';
import assert from 'node:assert/strict';
import {createSyntheticCustodianServer} from './synthetic-custodian-server.mjs';
test('synthetic listener is disabled unless explicit development opt-in',()=>{
 const a=process.env.NODE_ENV,b=process.env.GAIZ_SYNTHETIC_PROVIDER_TEST;
 try{
  process.env.NODE_ENV='production';process.env.GAIZ_SYNTHETIC_PROVIDER_TEST='true';
  assert.throws(()=>createSyntheticCustodianServer({}),/disabled/);
  process.env.NODE_ENV='development';delete process.env.GAIZ_SYNTHETIC_PROVIDER_TEST;
  assert.throws(()=>createSyntheticCustodianServer({}),/disabled/);
 }finally{
  if(a===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=a;
  if(b===undefined)delete process.env.GAIZ_SYNTHETIC_PROVIDER_TEST;else process.env.GAIZ_SYNTHETIC_PROVIDER_TEST=b;
 }
});
test('synthetic listener will not bind to a non-loopback interface',()=>{
 const a=process.env.NODE_ENV,b=process.env.GAIZ_SYNTHETIC_PROVIDER_TEST;
 try{
  process.env.NODE_ENV='development';process.env.GAIZ_SYNTHETIC_PROVIDER_TEST='true';
  assert.throws(()=>createSyntheticCustodianServer({
    host:'0.0.0.0',port:8443,tlsServerIdentity:{key:'test',cert:'test'},clientCA:'test',
  }),/disabled/);
 }finally{
  if(a===undefined)delete process.env.NODE_ENV;else process.env.NODE_ENV=a;
  if(b===undefined)delete process.env.GAIZ_SYNTHETIC_PROVIDER_TEST;else process.env.GAIZ_SYNTHETIC_PROVIDER_TEST=b;
 }
});
