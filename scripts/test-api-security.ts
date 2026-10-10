import assert from 'node:assert/strict';
import {constantTimeSecretEquals,readJsonBody} from '../lib/api-security';

async function main(){
 assert.equal(constantTimeSecretEquals('secret','secret'),true,'matching secrets should pass');
 assert.equal(constantTimeSecretEquals('secret','wrong'),false,'different secrets should fail');
 assert.equal(constantTimeSecretEquals(undefined,'secret'),false,'missing configured secret should fail closed');
 assert.equal(constantTimeSecretEquals('secret',undefined),false,'missing supplied secret should fail closed');

 const valid=await readJsonBody(new Request('https://reasonlens.test',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ok:true})}));
 assert.equal(valid.ok,true,'valid JSON should parse');
 if(valid.ok)assert.deepEqual(valid.value,{ok:true});

 const malformed=await readJsonBody(new Request('https://reasonlens.test',{method:'POST',body:'{"broken":'}));
 assert.equal(malformed.ok,false,'malformed JSON should be rejected');
 if(!malformed.ok)assert.equal(malformed.status,400);

 const oversized=await readJsonBody(new Request('https://reasonlens.test',{method:'POST',body:JSON.stringify({payload:'x'.repeat(128)})}),64);
 assert.equal(oversized.ok,false,'oversized JSON should be rejected');
 if(!oversized.ok)assert.equal(oversized.status,413);

 const declaredOversized=await readJsonBody(new Request('https://reasonlens.test',{method:'POST',headers:{'Content-Length':'1000'},body:'{}'}),64);
 assert.equal(declaredOversized.ok,false,'oversized declared content length should be rejected');
 if(!declaredOversized.ok)assert.equal(declaredOversized.status,413);

 console.log('API security tests passed (credential comparison, JSON parsing, malformed input, body limits).');
}

main().catch(error=>{console.error(error);process.exitCode=1;});
