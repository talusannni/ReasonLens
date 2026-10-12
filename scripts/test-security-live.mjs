/**
 * Live ReasonLens security integration test with automatic test-team provisioning.
 *
 * Required:
 *   REASONLENS_SECURITY_TEST_BASE_URL
 *   REASONLENS_SECURITY_TEST_SUPABASE_URL
 *   REASONLENS_SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY
 *   REASONLENS_SECURITY_TEST_ALLOW_WRITES=true
 *
 * Creates three persistent test workspaces and API keys on first run. Plaintext
 * keys are saved locally in .security-test-credentials.json (git-ignored). The
 * suite deletes only synthetic traces created during this run; test workspaces
 * and keys are retained so they can be reused.
 */
import assert from 'node:assert/strict';
import {createHash, randomBytes, randomUUID} from 'node:crypto';
import {readFile, writeFile} from 'node:fs/promises';

const base=(process.env.REASONLENS_SECURITY_TEST_BASE_URL||'').replace(/\/$/,'');
const allowWrites=process.env.REASONLENS_SECURITY_TEST_ALLOW_WRITES==='true';
const allowProduction=process.env.REASONLENS_SECURITY_TEST_ALLOW_PRODUCTION==='true';
const supabaseUrl=(process.env.REASONLENS_SECURITY_TEST_SUPABASE_URL||'').replace(/\/$/,'');
const serviceKey=process.env.REASONLENS_SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY||'';
const credentialsPath='.security-test-credentials.json';
const timeoutMs=12000;
const created=[];
let teams=[];

function required(value,name){if(!value)throw new Error('Missing required environment variable: '+name);}
function headers(){return {apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'};}
function hash(value){return createHash('sha256').update(value).digest('hex');}
function safeLabel(label,status){console.log((status?'PASS ':'FAIL ')+label+' (HTTP '+status+')');}

async function supabaseRequest(path,{method='GET',body,prefer}={}){
  const response=await fetch(supabaseUrl+'/rest/v1/'+path,{
    method,headers:{...headers(),...(prefer?{Prefer:prefer}:{})},
    body:body===undefined?undefined:JSON.stringify(body),
    cache:'no-store',signal:AbortSignal.timeout(timeoutMs)
  });
  const text=await response.text();
  let parsed;
  try{parsed=JSON.parse(text);}catch{parsed=text.slice(0,300);}
  if(!response.ok)throw new Error('Supabase '+method+' '+path+' failed with HTTP '+response.status+': '+JSON.stringify(parsed).slice(0,300));
  return parsed;
}

async function provisionTeams(){
  // Reuse locally saved credentials on reruns, but never accept a file for a different DB.
  try{
    const saved=JSON.parse(await readFile(credentialsPath,'utf8'));
    if(saved.supabaseUrl===supabaseUrl&&Array.isArray(saved.teams)&&saved.teams.length===3&&saved.teams.every(t=>t.key&&t.workspaceId)){
      console.log('Reusing locally saved security test workspaces and keys.');
      return saved.teams;
    }
  }catch{/* First run or unreadable credentials file: provision new teams. */}

  const suffix=randomUUID().replace(/-/g,'').slice(0,8);
  const definitions=[
    {name:'Security Test Alpha',slug:'security-test-alpha-'+suffix,label:'A'},
    {name:'Security Test Bravo',slug:'security-test-bravo-'+suffix,label:'B'},
    {name:'Security Test Charlie',slug:'security-test-charlie-'+suffix,label:'C'}
  ];
  const provisioned=[];
  try{
    for(const def of definitions){
      const workspaceId=randomUUID();
      const key='rls_live_'+randomBytes(32).toString('base64url');
      await supabaseRequest('reasonlens_workspaces',{method:'POST',prefer:'return=minimal',body:{
        id:workspaceId,name:def.name,slug:def.slug,status:'active'
      }});
      try{
        await supabaseRequest('reasonlens_api_keys',{method:'POST',prefer:'return=minimal',body:{
          workspace_id:workspaceId,name:'Automated security test key',key_hash:hash(key)
        }});
      }catch(error){
        const q=new URLSearchParams({id:'eq.'+workspaceId});
        await fetch(supabaseUrl+'/rest/v1/reasonlens_workspaces?'+q,{method:'DELETE',headers:headers(),cache:'no-store'}).catch(()=>undefined);
        throw error;
      }
      provisioned.push({...def,key,workspaceId});
      console.log('Provisioned '+def.name+' ('+workspaceId+').');
    }
  }catch(error){
    // Do not print API keys or write a partial credentials file.
    throw error;
  }
  const saved={createdAt:new Date().toISOString(),supabaseUrl,teams:provisioned};
  await writeFile(credentialsPath,JSON.stringify(saved,null,2)+'\n',{encoding:'utf8',mode:0o600});
  console.log('Saved workspace IDs and API keys to '+credentialsPath+' (keep this file private; it is git-ignored).');
  return provisioned;
}

async function appRequest(path,{key,method='GET',body,expectedStatus}={}){
  const requestHeaders={Accept:'application/json'};
  if(key)requestHeaders.Authorization='Bearer '+key;
  if(body!==undefined)requestHeaders['Content-Type']='application/json';
  const response=await fetch(base+path,{
    method,headers:requestHeaders,body:body===undefined?undefined:JSON.stringify(body),
    cache:'no-store',signal:AbortSignal.timeout(timeoutMs)
  });
  const text=await response.text();
  let parsed;
  try{parsed=JSON.parse(text);}catch{parsed=text.slice(0,300);}
  if(expectedStatus!==undefined){
    assert.equal(response.status,expectedStatus,path+' expected HTTP '+expectedStatus+' but received '+response.status+'; response='+JSON.stringify(parsed));
    safeLabel(path,response.status);
  }
  return {status:response.status,body:parsed};
}

async function cleanup(){
  for(const record of created){
    const params=new URLSearchParams({id:'eq.'+record.id,workspace_id:'eq.'+record.workspaceId,select:'id'});
    try{
      const rows=await supabaseRequest('reasonlens_traces?'+params,{method:'DELETE',prefer:'return=representation'});
      console.log('CLEANUP removed '+(Array.isArray(rows)?rows.length:0)+' test trace(s) from workspace '+record.workspaceId+'.');
    }catch(error){
      console.error('CLEANUP WARNING: trace '+record.id+' in workspace '+record.workspaceId+' could not be removed: '+(error instanceof Error?error.message:'unknown error'));
    }
  }
}

async function main(){
  required(base,'REASONLENS_SECURITY_TEST_BASE_URL');
  required(supabaseUrl,'REASONLENS_SECURITY_TEST_SUPABASE_URL');
  required(serviceKey,'REASONLENS_SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY');
  if(!allowWrites)throw new Error('Refusing writes. Set REASONLENS_SECURITY_TEST_ALLOW_WRITES=true only after confirming the target and Supabase project.');
  const target=new URL(base);
  if(target.protocol!=='https:'&&target.hostname!=='localhost'&&target.hostname!=='127.0.0.1')throw new Error('Target must use HTTPS unless localhost.');
  if(!allowProduction&&/(^|\.)reasonlens\.vercel\.app$/i.test(target.hostname))throw new Error('Production host blocked. Use a preview/staging deployment. Set REASONLENS_SECURITY_TEST_ALLOW_PRODUCTION=true only if you explicitly accept production risk.');
  if(!/^https:\/\//i.test(supabaseUrl))throw new Error('Supabase URL must use HTTPS.');

  teams=await provisionTeams();
  assert.equal(new Set(teams.map(t=>t.workspaceId)).size,3,'Each test team must have a unique workspace.');
  assert.equal(new Set(teams.map(t=>t.key)).size,3,'Each test team must have a unique API key.');
  console.log('LIVE security test target: '+base);
  console.log('Supabase project: '+new URL(supabaseUrl).host);
  console.log('Test workspace credentials are saved locally; API keys are not printed to the terminal.');

  try{
    await appRequest('/api/traces',{expectedStatus:401});
    await appRequest('/api/traces',{key:'rl_live_invalid_test_key_not_real',expectedStatus:401});

    const marker='reasonlens-live-security-test-'+randomUUID();
    for(const team of teams){
      const trace={
        id:randomUUID(),createdAt:new Date().toISOString(),provider:'security-test',model:'live-integration',
        prompt:marker+'-team-'+team.label,mode:'chat',answer:'synthetic test data for '+team.label,
        status:'completed',metrics:{latencyMs:1,inputTokens:1,outputTokens:1,estimatedCostUsd:0},
        nodes:[],edges:[],lineage:{workflowId:marker+'-'+team.label}
      };
      const write=await appRequest('/api/traces',{key:team.key,method:'POST',body:trace,expectedStatus:202});
      assert.equal(write.body.id,trace.id,'API should acknowledge the exact created trace ID');
      created.push({id:trace.id,workspaceId:team.workspaceId});
    }

    const lists=[];
    for(const team of teams){
      const result=await appRequest('/api/traces',{key:team.key,expectedStatus:200});
      assert(result.body&&Array.isArray(result.body.traces),'Authenticated trace list response must contain a traces array');
      lists.push(new Set(result.body.traces.map(t=>t.id)));
    }
    for(let owner=0;owner<3;owner++){
      assert(lists[owner].has(created[owner].id),'Team '+teams[owner].label+' must read its own trace');
      for(let viewer=0;viewer<3;viewer++){
        if(viewer!==owner)assert(!lists[viewer].has(created[owner].id),'Team '+teams[viewer].label+' must not see Team '+teams[owner].label+' trace');
      }
    }
    console.log('PASS three-team live trace isolation');

    await appRequest('/api/traces',{key:teams[0].key,method:'POST',body:{invalid:true},expectedStatus:400});
    const oversized=await fetch(base+'/api/traces',{
      method:'POST',headers:{Authorization:'Bearer '+teams[0].key,'Content-Type':'application/json'},
      body:JSON.stringify({padding:'x'.repeat(1024*1024+100)}),signal:AbortSignal.timeout(timeoutMs)
    });
    assert.equal(oversized.status,413,'Oversized request must be rejected');
    safeLabel('oversized trace payload rejected',oversized.status);
    console.log('LIVE security integration tests passed. This is not a comprehensive penetration test.');
  }finally{
    await cleanup();
  }
}
main().catch(error=>{console.error('LIVE security integration test failed:',error instanceof Error?error.message:error);process.exitCode=1;});
