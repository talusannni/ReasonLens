import assert from 'node:assert/strict';
import {getTrace} from '../lib/trace-store';
import {getEvaluationRun} from '../lib/evaluation-store';
import {consumeWorkspaceRateLimit} from '../lib/workspace-rate-limit';
import {enforceWorkspaceRateLimit} from '../lib/rate-limit-response';

async function main(){
 const previousUrl=process.env.SUPABASE_URL;
 const previousKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 process.env.SUPABASE_URL='https://supabase.test';
 process.env.SUPABASE_SERVICE_ROLE_KEY='service-test-key';
 const originalFetch=globalThis.fetch;
 const requests:string[]=[];
 try{
  globalThis.fetch=(async (input:RequestInfo|URL,init?:RequestInit)=>{
   const url=String(input);requests.push(url);
   const parsed=new URL(url);
   const workspace=parsed.searchParams.get('workspace_id');
   if(parsed.pathname.endsWith('/reasonlens_traces')){
    const rows=workspace==='eq.workspace-a'?[{
     id:'trace-a',created_at:'2026-10-10T00:00:00.000Z',provider:'mock',model:'mock',prompt:'p',mode:'chat',answer:'a',status:'completed',
     metrics:{latencyMs:1,inputTokens:1,outputTokens:1,estimatedCostUsd:0},nodes:[],edges:[],workspace_id:'workspace-a'
    }]:[];
    return new Response(JSON.stringify(rows),{status:200,headers:{'Content-Type':'application/json'}});
   }
   if(parsed.pathname.endsWith('/reasonlens_evaluation_runs')){
    const rows=workspace==='eq.workspace-a'?[{
     id:'eval-a',created_at:'2026-10-10T00:00:00.000Z',name:'run',dataset:[],results:[],
     summary:{totalCases:0,evaluatedCases:0,missingCases:0,passedCases:0,warnedCases:0,failedCases:0,passRate:0,averageProvenanceScore:0,totalLatencyMs:0,averageLatencyMs:0,totalCostUsd:0},
     workspace_id:'workspace-a'
    }]:[];
    return new Response(JSON.stringify(rows),{status:200,headers:{'Content-Type':'application/json'}});
   }
   if(parsed.pathname.endsWith('/rpc/reasonlens_consume_rate_limit')){
    return new Response(JSON.stringify([{allowed:false,remaining:0,reset_at:'2026-10-11T10:00:00.000Z'}]),{status:200,headers:{'Content-Type':'application/json'}});
   }
   throw new Error('Unexpected fetch: '+url);
  }) as typeof fetch;

  const traceA=await getTrace('trace-a','workspace-a');
  assert.equal(traceA?.id,'trace-a','workspace A should read its own trace');
  const traceB=await getTrace('trace-a','workspace-b');
  assert.equal(traceB,undefined,'workspace B must not read workspace A trace');
  const evalA=await getEvaluationRun('eval-a','workspace-a');
  assert.equal(evalA?.id,'eval-a','workspace A should read its own evaluation');
  const evalB=await getEvaluationRun('eval-a','workspace-b');
  assert.equal(evalB,undefined,'workspace B must not read workspace A evaluation');
  assert(requests.some(url=>new URL(url).searchParams.get('workspace_id')==='eq.workspace-a'));
  assert(requests.some(url=>new URL(url).searchParams.get('workspace_id')==='eq.workspace-b'));

  const limit=await consumeWorkspaceRateLimit('workspace-a','test',60,10);
  assert.equal(limit.allowed,false,'database rate limit result should be respected');
  assert.equal(limit.remaining,0);
  const limitedResponse=await enforceWorkspaceRateLimit('workspace-a','test',60,10);
  assert.equal(limitedResponse?.status,429,'exhausted limit should return HTTP 429');
  assert.equal(limitedResponse?.headers.get('Retry-After')!==null,true,'429 should include Retry-After');

  globalThis.fetch=(async()=>{throw new Error('database unavailable');}) as typeof fetch;
  const unavailable=await enforceWorkspaceRateLimit('workspace-a','test',60,10);
  assert.equal(unavailable?.status,503,'rate-limit backend failure must fail closed');
  console.log('Workspace isolation and rate-limit tests passed.');
 }finally{
  globalThis.fetch=originalFetch;
  if(previousUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=previousUrl;
  if(previousKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=previousKey;
 }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
