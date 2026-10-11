const base=(process.env.REASONLENS_BASE_URL||'https://reasonlens.vercel.app').replace(/\/$/,'');
const timeoutMs=10000;
const protectionHeaders=process.env.REASONLENS_VERCEL_BYPASS_SECRET?{'x-vercel-protection-bypass':process.env.REASONLENS_VERCEL_BYPASS_SECRET}:{};

async function request(path,init={}){
 const response=await fetch(base+path,{...init,signal:AbortSignal.timeout(timeoutMs),headers:{'Content-Type':'application/json',...protectionHeaders,...(init.headers||{})}});
 const text=await response.text();
 let body;
 try{body=JSON.parse(text);}catch{body=text.slice(0,240);}
 return {status:response.status,body};
}
function expect(name,result,status){
 if(result.status!==status)throw new Error(name+' expected HTTP '+status+', received '+result.status+'; body='+JSON.stringify(result.body));
 console.log('PASS '+name+' → '+result.status);
}

async function main(){
 console.log('ReasonLens production smoke tests: '+base);
 const health=await request('/api/health');
 expect('health endpoint',health,200);
 if(!health.body||health.body.status!=='ok'||health.body.service!=='reasonlens')throw new Error('Health response has an unexpected shape');
 const ready=await request('/api/health/ready');
 expect('storage readiness endpoint',ready,200);
 if(!ready.body||ready.body.status!=='ready'||ready.body.service!=='reasonlens')throw new Error('Readiness response has an unexpected shape');

 expect('trace read rejects missing credentials',await request('/api/traces'),401);
 expect('trace ingestion rejects missing credentials',await request('/api/traces',{method:'POST',body:'{}'}),401);
 expect('dashboard history rejects missing session',await request('/api/dashboard/traces'),401);

 expect('blank demo prompt is rejected before execution',await request('/api/trace',{method:'POST',body:JSON.stringify({prompt:'   ',provider:'mock'})}),400);
 const demo=await request('/api/trace',{method:'POST',body:JSON.stringify({prompt:'ReasonLens public demo smoke test',provider:'mock',mode:'chat'})});
 expect('public demo execution remains available without persistence credentials',demo,200);
 if(!demo.body||typeof demo.body.id!=='string'||!Array.isArray(demo.body.nodes)||!Array.isArray(demo.body.edges))throw new Error('Demo trace response is missing required trace fields');
 expect('oversized prompt is rejected before execution',await request('/api/trace',{method:'POST',body:JSON.stringify({prompt:'x'.repeat(12001),provider:'mock'})}),413);
 expect('hosted Groq execution requires dashboard session',await request('/api/trace',{method:'POST',body:JSON.stringify({prompt:'ReasonLens smoke test',provider:'groq'})}),401);
 expect('invalid dashboard key is rejected',await request('/api/dashboard/login',{method:'POST',body:JSON.stringify({key:'reasonlens-invalid-smoke-test-key'})}),401);

 console.log('All '+10+' production smoke checks passed.');
}
main().catch(error=>{console.error('Production smoke test failed:',error instanceof Error?error.message:error);process.exitCode=1;});
