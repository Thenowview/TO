import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync,randomBytes } from 'node:crypto';
import { wrapGaizDekCandidate,unwrapGaizDekCandidate } from './recipient-wrap-candidate.mjs';
const recipient=generateKeyPairSync('x25519'),other=generateKeyPairSync('x25519');
const context={tenantScope:'tenant-A',artifactId:'synthetic-artifact-1',recipientKeyId:'recipient-key-A'};
const expected={expectedTenantScope:context.tenantScope,
  expectedArtifactId:context.artifactId,expectedRecipientKeyId:context.recipientKeyId};
const source=()=>randomBytes(32);
test('detached recipient wrap restores an independently generated test DEK',()=>{
  const dek=source();
  const wrapped=wrapGaizDekCandidate({dek,recipientPublicKey:recipient.publicKey,...context});
  const recovered=unwrapGaizDekCandidate(wrapped,{
    recipientPrivateKey:recipient.privateKey,...expected,
  });
  assert.deepEqual(recovered,dek);
  assert.notEqual(wrapped.wrappedDek,dek.toString('base64url'));
  assert.equal(wrapped.version,1);
  recovered.fill(0);dek.fill(0);
});
test('a distinct recipient cannot unwrap the same envelope',()=>{
  const dek=source(),wrapped=wrapGaizDekCandidate({dek,recipientPublicKey:recipient.publicKey,...context});
  assert.throws(()=>unwrapGaizDekCandidate(wrapped,{
    recipientPrivateKey:other.privateKey,...expected,
  }));
  dek.fill(0);
});
test('context substitution and ciphertext/tag tampering fail closed',()=>{
  const dek=source(),wrapped=wrapGaizDekCandidate({dek,recipientPublicKey:recipient.publicKey,...context});
  for(const field of ['tenantScope','artifactId','recipientKeyId']){
    assert.throws(()=>unwrapGaizDekCandidate({...wrapped,[field]:'attacker'},{
      recipientPrivateKey:recipient.privateKey,...expected,
    }));
  }
  for(const field of ['wrappedDek','tag','nonce','salt']){
    const altered=Buffer.from(wrapped[field],'base64url');altered[0]^=1;
    assert.throws(()=>unwrapGaizDekCandidate({...wrapped,[field]:altered.toString('base64url')},{
      recipientPrivateKey:recipient.privateKey,...expected,
    }));
  }
  assert.throws(()=>unwrapGaizDekCandidate(wrapped,{
    recipientPrivateKey:recipient.privateKey,...expected,expectedTenantScope:'tenant-B',
  }));
  dek.fill(0);
});
test('unsupported algorithms, extra fields and non-X25519 keys fail closed',()=>{
  const dek=source(),wrapped=wrapGaizDekCandidate({dek,recipientPublicKey:recipient.publicKey,...context});
  assert.throws(()=>unwrapGaizDekCandidate({...wrapped,algorithm:'AES-CTR'},{
    recipientPrivateKey:recipient.privateKey,...expected,
  }));
  assert.throws(()=>unwrapGaizDekCandidate({...wrapped,override:true},{
    recipientPrivateKey:recipient.privateKey,...expected,
  }));
  assert.throws(()=>wrapGaizDekCandidate({dek,recipientPublicKey:generateKeyPairSync('ed25519').publicKey,...context}));
  dek.fill(0);
});
