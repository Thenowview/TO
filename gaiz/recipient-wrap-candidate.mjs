/**
 * GAIZ recipient wrapping candidate v1 — OFFLINE EXPERIMENT, NOT GAIZ1 WIRE.
 *
 * This is an independent detached test envelope. Existing createGaiz and
 * decryptGaiz are intentionally untouched. No deployment, vault or key service.
 *
 * X25519 ephemeral ECDH -> HKDF-SHA256 -> AES-256-GCM.
 * Context is bound in both HKDF info and AEAD AAD. The DEK itself must be
 * independently random and used only with the matching GAIZ1 payload.
 */
import {
  createCipheriv,createDecipheriv,createPublicKey,createPrivateKey,
  diffieHellman,generateKeyPairSync,hkdfSync,randomBytes,
} from 'node:crypto';
const deny=()=>{throw Error('GAIZ recipient wrapping denied')};
const id=x=>typeof x==='string'&&/^[A-Za-z0-9._:-]{1,128}$/.test(x);
const scope=x=>typeof x==='string'&&x.length>0&&x.length<=256&&
  !/[\x00-\x1f<>]/.test(x);
const b64=b=>Buffer.from(b).toString('base64url');
const decode=(s,len)=>{
  if(typeof s!=='string'||s.length>2048||!/^[A-Za-z0-9_-]+$/.test(s))deny();
  const out=Buffer.from(s,'base64url');
  if(out.toString('base64url')!==s||(len!==undefined&&out.length!==len))deny();
  return out;
};
const keys='algorithm,artifactId,ephemeralPublicKey,nonce,recipientKeyId,salt,tag,tenantScope,version,wrappedDek';
const aad=(tenantScope,artifactId,recipientKeyId)=>
  Buffer.from(JSON.stringify(['GAIZ_DEK_WRAP_V1',tenantScope,artifactId,recipientKeyId]),'utf8');
const pub=x=>{
  try{
    const key=x?.type==='public'?x:createPublicKey(x);
    if(key.asymmetricKeyType!=='x25519')deny();
    return key;
  }catch{deny()}
};
const priv=x=>{
  try{
    const key=x?.type==='private'?x:createPrivateKey(x);
    if(key.asymmetricKeyType!=='x25519')deny();
    return key;
  }catch{deny()}
};
function derive(privateKey,publicKey,salt,context){
  const shared=diffieHellman({privateKey,publicKey});
  try{
    return Buffer.from(hkdfSync('sha256',shared,salt,context,32));
  }finally{shared.fill(0)}
}
const checkContext=(tenantScope,artifactId,recipientKeyId)=>{
  if(!scope(tenantScope)||!scope(artifactId)||!id(recipientKeyId))deny();
};
export function wrapGaizDekCandidate({
  dek,recipientPublicKey,tenantScope,artifactId,recipientKeyId,
}={}){
  checkContext(tenantScope,artifactId,recipientKeyId);
  if(!Buffer.isBuffer(dek)||dek.length!==32)deny();
  const recipient=pub(recipientPublicKey);
  const ephemeral=generateKeyPairSync('x25519');
  const salt=randomBytes(32),nonce=randomBytes(12);
  const context=aad(tenantScope,artifactId,recipientKeyId);
  const wrapKey=derive(ephemeral.privateKey,recipient,salt,context);
  try{
    const cipher=createCipheriv('aes-256-gcm',wrapKey,nonce);
    cipher.setAAD(context);
    const wrappedDek=Buffer.concat([cipher.update(dek),cipher.final()]);
    return Object.freeze({
      version:1,algorithm:'X25519-HKDF-SHA256-AES256GCM',
      tenantScope,artifactId,recipientKeyId,
      ephemeralPublicKey:b64(ephemeral.publicKey.export({format:'der',type:'spki'})),
      salt:b64(salt),nonce:b64(nonce),tag:b64(cipher.getAuthTag()),
      wrappedDek:b64(wrappedDek),
    });
  }finally{wrapKey.fill(0)}
}
export function unwrapGaizDekCandidate(envelope,{
  recipientPrivateKey,expectedTenantScope,expectedArtifactId,
  expectedRecipientKeyId,
}={}){
  if(!envelope||typeof envelope!=='object'||Array.isArray(envelope)||
     Object.keys(envelope).sort().join(',')!==keys||
     envelope.version!==1||
     envelope.algorithm!=='X25519-HKDF-SHA256-AES256GCM')deny();
  checkContext(expectedTenantScope,expectedArtifactId,expectedRecipientKeyId);
  if(envelope.tenantScope!==expectedTenantScope||
     envelope.artifactId!==expectedArtifactId||
     envelope.recipientKeyId!==expectedRecipientKeyId)deny();
  let ephem;
  try{ephem=pub(createPublicKey({
    key:decode(envelope.ephemeralPublicKey),
    format:'der',type:'spki',
  }))}catch{deny()}
  const salt=decode(envelope.salt,32),nonce=decode(envelope.nonce,12);
  const tag=decode(envelope.tag,16),encrypted=decode(envelope.wrappedDek,32);
  const context=aad(expectedTenantScope,expectedArtifactId,expectedRecipientKeyId);
  const wrapKey=derive(priv(recipientPrivateKey),ephem,salt,context);
  try{
    const decipher=createDecipheriv('aes-256-gcm',wrapKey,nonce);
    decipher.setAAD(context);
    decipher.setAuthTag(tag);
    const dek=Buffer.concat([decipher.update(encrypted),decipher.final()]);
    if(dek.length!==32)deny();
    return dek;
  }catch{deny()}finally{wrapKey.fill(0)}
}
