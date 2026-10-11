import assert from 'node:assert/strict';
import {getTrace,deleteTrace} from '../lib/trace-store';
import {getEvaluationRun,deleteEvaluationRun} from '../lib/evaluation-store';
import {rateLimitBucketKey} from '../lib/rate-limit';

const originalFetch=globalThis.fetch;
const originalUrl=process.env.SUPABASE_URL;
const originalKey=process.env.SUPABASE_SERVICE_ROLE_KEY;

const traceRow={
 id:'11111111-1111-4111-8111-111111111111',
 workspace_id:'workspace-a',
 created_at:'2026-10-11T00:00:00.000Z',
 provider:'mock',model:'test-model',prompt:'tenant isolation test',mode:'chat',answer:'answer',
 status:'completed',metrics:{latencyMs:1,inputTokens:1,outputTokens:1,estimatedCostUsd:0},
 nodes:[],edges:[],workflow_id:'workflow-a',parent_trace_id:null,experiment_id:null,config_fingerprint:null
};
const evaluationRow={
 id:'22222222-2222-4222-8222-222222222222',
 workspace_id:'workspace-a',created_at:'2026-10-11T00:00:00.000Z',name:'workspace-a evaluation',
 dataset:[],results:[],summary:{totalCases:0,evaluatedCases:0,missingCases:0,passedCases:0,warnedCases:0,failedCases:0,passRate:0,averageProvenanceScore:0,totalLatencyMs:0,averageLatencyMs:0,totalCostUsd:0}
};

async function main(){
 process.env.SUPABASE_URL='https://reasonlens-test.supabase.co';
 process.env.SUPABASE_SERVICE_ROLE_KEY='test-service-role-key';

 const requestedScopes:string[]=[];
 globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const raw=typeof input==='string'?input:input instanceof URL?input.href:input.url;
  const url=new URL(raw);
  if(url.pathname.endsWith('/reasonlens_traces')){
   const workspace=url.searchParams.get('workspace_id')||'';
   requestedScopes.push(workspace);
   const rows=workspace==='eq.workspace-a'&&url.searchParams.get('id')==='eq.'+traceRow.id?[traceRow]:[];
   return new Response(JSON.stringify(rows),{status:200,headers:{'Content-Type':'application/json'}});
  }
  if(url.pathname.endsWith('/reasonlens_evaluation_runs')){
   const workspace=url.searchParams.get('workspace_id')||'';
   requestedScopes.push(workspace);
   const rows=workspace==='eq.workspace-a'&&url.searchParams.get('id')==='eq.'+evaluationRow.id?[evaluationRow]:[];
   return new Response(JSON.stringify(rows),{status:200,headers:{'Content-Type':'application/json'}});
  }
  throw new Error('Unexpected mocked request: '+url.pathname);
 }) as typeof fetch;

 try{
  const ownTrace=await getTrace(traceRow.id,'workspace-a');
  assert.equal(ownTrace?.id,traceRow.id,'workspace A should read its own trace');
  const foreignTrace=await getTrace(traceRow.id,'workspace-b');
  assert.equal(foreignTrace,undefined,'workspace B must not read workspace A trace');
  const ownEvaluation=await getEvaluationRun(evaluationRow.id,'workspace-a');
  assert.equal(ownEvaluation?.name,'workspace-a evaluation','workspace A should read its own evaluation');
  const foreignEvaluation=await getEvaluationRun(evaluationRow.id,'workspace-b');
  assert.equal(foreignEvaluation,undefined,'workspace B must not read workspace A evaluation');
  assert.equal(await deleteTrace(traceRow.id,'workspace-b'),false,'workspace B must not delete workspace A trace');
  assert.equal(await deleteTrace(traceRow.id,'workspace-a'),true,'workspace A should be able to delete its own trace');
  assert.equal(await deleteEvaluationRun(evaluationRow.id,'workspace-b'),false,'workspace B must not delete workspace A evaluation');
  assert.equal(await deleteEvaluationRun(evaluationRow.id,'workspace-a'),true,'workspace A should be able to delete its own evaluation');
  assert(requestedScopes.every(scope=>scope.startsWith('eq.workspace-')),'every data read must include a workspace filter');
  assert.equal(rateLimitBucketKey('workspace-a:trace-write'),rateLimitBucketKey('workspace-a:trace-write'),'same rate-limit scope should be stable');
  assert.notEqual(rateLimitBucketKey('workspace-a:trace-write'),rateLimitBucketKey('workspace-b:trace-write'),'different workspaces must have different rate-limit buckets');
  console.log('Tenant isolation tests passed (workspace-scoped trace/evaluation reads and deletes, workspace filters, rate-limit scope separation).');
 }finally{
  globalThis.fetch=originalFetch;
  if(originalUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=originalUrl;
  if(originalKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=originalKey;
 }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
