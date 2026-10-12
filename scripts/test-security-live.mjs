/**
 * Live ReasonLens security integration test.
 *
 * Sends real HTTP requests to a configured ReasonLens deployment and uses the
 * configured Supabase service-role credential ONLY to clean up trace IDs created
 * by this run. Use a dedicated test deployment/project and dedicated test keys.
 *
 * Required environment:
 *   REASONLENS_SECURITY_TEST_BASE_URL
 *   REASONLENS_SECURITY_TEST_TEAM_A_KEY
 *   REASONLENS_SECURITY_TEST_TEAM_B_KEY
 *   REASONLENS_SECURITY_TEST_TEAM_C_KEY
 *   REASONLENS_SECURITY_TEST_TEAM_A_WORKSPACE_ID
 *   REASONLENS_SECURITY_TEST_TEAM_B_WORKSPACE_ID
 *   REASONLENS_SECURITY_TEST_TEAM_C_WORKSPACE_ID
 *   REASONLENS_SECURITY_TEST_SUPABASE_URL
 *   REASONLENS_SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY
 *   REASONLENS_SECURITY_TEST_ALLOW_WRITES=true
 *
 * Production hosts are blocked unless REASONLENS_SECURITY_TEST_ALLOW_PRODUCTION=true.
 * Never commit real keys to source control or CI logs.
 */
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';

const base=(process.env.REASONLENS_SECURITY_TEST_BASE_URL||'').replace(/\/$/,'');
const allowWrites=process.env.REASONLENS_SECURITY_TEST_ALLOW_WRITES==='true';
const allowProduction=process.env.REASONLENS_SECURITY_TEST_ALLOW_PRODUCTION==='true';
const supabaseUrl=(process.env.REASONLENS_SECURITY_TEST_SUPABASE_URL||'').replace(/\/$/,'');
const serviceKey=process.env.REASONLENS_SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY||'';
const teams=[
  {name:'A',key:process.env.REASONLENS_SECURITY_TEST_TEAM_A_KEY||'',workspaceId:process.env.REASONLENS_SECURITY_TEST_TEAM_A_WORKSPACE_ID||''},
  {name:'B',key:process.env.REASONLENS_SECURITY_TEST_TEAM_B_KEY||'',workspaceId:process.env.REASONLENS_SECURITY_TEST_TEAM_B_WORKSPACE_ID||''},
  {name:'C',key:process.env.REASONLENS_SECURITY_TEST_TEAM_C_KEY||'',workspaceId:process.env.REASONLENS_SECURITY_TEST_TEAM_C_WORKSPACE_ID||''}
];
const timeoutMs=12000;
const created=[];

function required(value,name){
  if(!value)throw new Error('Missing required environment variable: '+name);
}
function safeLabel(label,status){
  console.log((status?'PASS ':'FAIL ')+label+' (HTTP '+status+')');
}
async function appRequest(path,{key,method='GET',body,expectedStatus}={}){
  const headers={Accept:'application/json'};
  if(key)headers.Authorization='Bearer '+key;
  if(body!==undefined)headers['Content-Type']='application/json';
  const response=await fetch(base+path,{
    method,headers,body:body===undefined?undefined:JSON.stringify(body),
    cache:'no-store',signal:AbortSignal.timeout(timeoutMs)
  });
  const text=await response.text();
  let parsed;
  try{parsed=JSON.parse(text);}catch{parsed=text.slice(0,300);}
  if(expectedStatus!==undefined){
    assert.equal(response.status,expectedStatus, path+' expected HTTP '+expectedStatus+' but received '+response.status+'; response='+JSON.stringify(parsed));
    safeLabel(path, response.status);
  }
  return {status:response.status,body:parsed};
}
async function cleanup(){
  if(!created.length)return;
  for(const record of created){
    const params=new URLSearchParams({id:'eq.'+record.id,workspace_id:'eq.'+record.workspaceId,select:'id'});
    const response=await fetch(supabaseUrl+'/rest/v1/reasonlens_traces?'+params,{
      method:'DELETE',
      headers:{apikey:serviceKey,Authorization:'Bearer '+serviceKey,Prefer:'return=representation'},
      signal:AbortSignal.timeout(timeoutMs),cache:'no-store'
    });
    if(!response.ok){
      console.error('CLEANUP WARNING: could not remove test trace '+record.id+' for workspace '+record.workspaceId+' (HTTP '+response.status+').');
    }else{
      console.log('CLEANUP removed test trace '+record.id);
    }
  }
}

async function main(){
  required(base,'REASONLENS_SECURITY_TEST_BASE_URL');
  required(supabaseUrl,'REASONLENS_SECURITY_TEST_SUPABASE_URL');
  required(serviceKey,'REASONLENS_SECURITY_TEST_SUPABASE_SERVICE_ROLE_KEY');
  for(const [i,team] of teams.entries()){
    required(team.key,'REASONLENS_SECURITY_TEST_TEAM_'+team.name+'_KEY');
    required(team.workspaceId,'REASONLENS_SECURITY_TEST_TEAM_'+team.name+'_WORKSPACE_ID');
    assert.notEqual(team.key,'TEST_KEY', 'Test keys must be provisioned in the test deployment');
    for(let j=0;j<i;j++){
      assert.notEqual(team.key,teams[j].key,'Each team must have a distinct API key');
      assert.notEqual(team.workspaceId,teams[j].workspaceId,'Each team must have a distinct workspace');
    }
  }
  if(!allowWrites)throw new Error('Refusing live writes. Set REASONLENS_SECURITY_TEST_ALLOW_WRITES=true only for a dedicated test environment.');
  const target=new URL(base);
  if(target.protocol!=='https:'&&target.hostname!=='localhost'&&target.hostname!=='127.0.0.1')throw new Error('Target must use HTTPS unless localhost.');
  if(!allowProduction&&/(^|\.)reasonlens\.vercel\.app$/i.test(target.hostname))throw new Error('Production host blocked. Use a dedicated test deployment or explicitly set REASONLENS_SECURITY_TEST_ALLOW_PRODUCTION=true (not recommended).');
  if(!/^https:\/\//i.test(supabaseUrl))throw new Error('Test Supabase URL must use HTTPS.');

  console.log('LIVE security tests target: '+base);
  console.log('WARNING: this suite creates temporary traces and attempts to delete them afterward.');
  try{
    // External unauthenticated and invalid-credential requests must not reveal data.
    await appRequest('/api/traces',{expectedStatus:401});
    await appRequest('/api/traces',{key:'rl_live_invalid_test_key_not_real',expectedStatus:401});

    const marker='reasonlens-live-security-test-'+randomUUID();
    for(const team of teams){
      const trace={
        id:randomUUID(),createdAt:new Date().toISOString(),provider:'security-test',model:'live-integration',
        prompt:marker+'-team-'+team.name,mode:'chat',answer:'synthetic test data for '+team.name,
        status:'completed',metrics:{latencyMs:1,inputTokens:1,outputTokens:1,estimatedCostUsd:0},
        nodes:[],edges:[],lineage:{workflowId:marker+'-'+team.name}
      };
      const write=await appRequest('/api/traces',{key:team.key,method:'POST',body:trace,expectedStatus:202});
      assert.equal(write.body.id,trace.id,'API should acknowledge the exact created trace ID');
      created.push({id:trace.id,workspaceId:team.workspaceId});
    }

    const lists=[];
    for(const team of teams){
      const result=await appRequest('/api/traces',{key:team.key,expectedStatus:200});
      assert(result.body&&Array.isArray(result.body.traces), 'Authenticated trace list response must contain a traces array');
      const ids=new Set(result.body.traces.map(t=>t.id));
      lists.push(ids);
    }
    for(let owner=0;owner<3;owner++){
      assert(lists[owner].has(created[owner].id),'Team '+teams[owner].name+' must read its own newly created trace');
      for(let viewer=0;viewer<3;viewer++){
        if(viewer===owner)continue;
        assert(!lists[viewer].has(created[owner].id),'Team '+teams[viewer].name+' must not see Team '+teams[owner].name+' trace');
      }
    }
    console.log('PASS three-team live trace isolation');

    // Authenticated malformed payload must be rejected without persistence.
    await appRequest('/api/traces',{key:teams[0].key,method:'POST',body:{invalid:true},expectedStatus:400});
    const oversized=await fetch(base+'/api/traces',{
      method:'POST',headers:{Authorization:'Bearer '+teams[0].key,'Content-Type':'application/json'},
      body:JSON.stringify({padding:'x'.repeat(1024*1024+100)}),signal:AbortSignal.timeout(timeoutMs)
    });
    assert.equal(oversized.status,413,'Oversized request must be rejected');
    safeLabel('oversized trace payload rejected',oversized.status);

    console.log('LIVE security integration tests passed. This covers real HTTP and Supabase-backed tenant isolation, not a full penetration test.');
  }finally{
    await cleanup();
  }
}
main().catch(error=>{console.error('LIVE security integration test failed:',error instanceof Error?error.message:error);process.exitCode=1;});
