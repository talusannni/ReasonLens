import assert from 'node:assert/strict';
import {getTrace,listTracePage,saveTrace} from '../lib/trace-store';
import {getEvaluationRun,listEvaluationRuns,saveEvaluationRun} from '../lib/evaluation-store';
import type {Trace} from '../lib/types';
import type {EvaluationRun} from '../lib/evaluation';

async function main(){
 const previousUrl=process.env.SUPABASE_URL;
 const previousKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const previousFetch=globalThis.fetch;
 const workspaceA='00000000-0000-4000-8000-00000000000a';
 const workspaceB='00000000-0000-4000-8000-00000000000b';
 const requests:Array<{url:string;method:string;body?:any}>=[];
 const traceA={id:'trace-owned-by-a',workspace_id:workspaceA,created_at:'2026-10-10T10:00:00.000Z',provider:'test',model:'test-model',prompt:'private workspace A prompt',mode:'chat',answer:'A only',status:'completed',metrics:{latencyMs:1,inputTokens:1,outputTokens:1,estimatedCostUsd:0},nodes:[],edges:[],workflow_id:'trace-owned-by-a',parent_trace_id:null,experiment_id:null,config_fingerprint:null};
 const evaluationA={id:'evaluation-owned-by-a',workspace_id:workspaceA,created_at:'2026-10-10T10:00:00.000Z',name:'A private evaluation',dataset:[],results:[],summary:{totalCases:0,evaluatedCases:0,missingCases:0,passedCases:0,warnedCases:0,failedCases:0,passRate:0,averageProvenanceScore:0,totalLatencyMs:0,averageLatencyMs:0,totalCostUsd:0}};
 const traceB:Trace={id:'trace-created-by-b',createdAt:'2026-10-10T11:00:00.000Z',provider:'test',model:'test-model',prompt:'workspace B prompt',mode:'chat',answer:'B answer',status:'completed',metrics:{latencyMs:1,inputTokens:1,outputTokens:1,estimatedCostUsd:0},nodes:[],edges:[]};
 const evaluationB:EvaluationRun={id:'evaluation-created-by-b',name:'B evaluation',createdAt:'2026-10-10T11:00:00.000Z',dataset:[],totalCases:0,evaluatedCases:0,missingCases:0,passedCases:0,warnedCases:0,failedCases:0,passRate:0,averageProvenanceScore:0,totalLatencyMs:0,averageLatencyMs:0,totalCostUsd:0,results:[]};

 process.env.SUPABASE_URL='https://reasonlens-isolation-test.supabase.co';
 process.env.SUPABASE_SERVICE_ROLE_KEY='test-service-role';
 globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
  const url=String(input);
  const method=init?.method||'GET';
  const body=typeof init?.body==='string'?JSON.parse(init.body):undefined;
  requests.push({url,method,body});
  const parsed=new URL(url);
  const table=parsed.pathname.split('/').pop();
  if(method==='POST'){
   return new Response(null,{status:201,headers:{'Content-Type':'application/json'}});
  }
  // Simulate PostgREST's workspace filter over records owned by workspace A.
  // A request scoped to workspace B must not receive those records.
  const requestedWorkspace=parsed.searchParams.get('workspace_id');
  const id=parsed.searchParams.get('id')?.replace(/^eq\./,'');
  let rows:any[]=[];
  if(table==='reasonlens_traces'&&requestedWorkspace===workspaceA){
   rows=[traceA].filter(row=>(!id||row.id===id));
  }else if(table==='reasonlens_evaluation_runs'&&requestedWorkspace===workspaceA){
   rows=[evaluationA].filter(row=>(!id||row.id===id));
  }
  const rangeHeaders:Record<string,string>={};
  if(table==='reasonlens_traces'&&parsed.searchParams.has('order'))rangeHeaders['Content-Range']=`0-${Math.max(0,rows.length-1)}/${rows.length}`;
  return new Response(JSON.stringify(rows),{status:200,headers:{'Content-Type':'application/json',...rangeHeaders}});
 }) as typeof fetch;

 try{
  // Adversarial reads: the mock database contains records owned by A, but B must never receive them.
  assert.equal(await getTrace(traceA.id,workspaceB),undefined,'workspace B must not read workspace A trace');
  assert.deepEqual(await listTracePage({page:1,pageSize:25},workspaceB).then(result=>result.traces),[],'workspace B trace list must exclude workspace A records');
  assert.equal(await getEvaluationRun(evaluationA.id,workspaceB),undefined,'workspace B must not read workspace A evaluation');
  assert.deepEqual(await listEvaluationRuns(workspaceB),[],'workspace B evaluation list must exclude workspace A records');

  const readRequests=requests.filter(request=>request.method==='GET');
  assert.ok(readRequests.length>=4,'expected trace and evaluation read requests');
  for(const request of readRequests){
   const query=new URL(request.url).searchParams;
   assert.equal(query.get('workspace_id'),'eq.'+workspaceB,'every read must be explicitly scoped to workspace B');
   assert.notEqual(query.get('workspace_id'),'eq.'+workspaceA,'no read may be scoped to workspace A');
  }

  // Writes must stamp the caller's workspace ID into the persisted row.
  await saveTrace(traceB,workspaceB);
  const traceWrite=requests.slice().reverse().find(request=>request.method==='POST'&&request.url.includes('/reasonlens_traces'));
  assert.ok(traceWrite,'trace write request should be sent');
  assert.equal(traceWrite.body.workspace_id,workspaceB,'trace writes must persist the requested workspace ID');
  assert.equal(traceWrite.body.id,traceB.id);

  await saveEvaluationRun(evaluationB,workspaceB);
  const evaluationWrite=requests.slice().reverse().find(request=>request.method==='POST'&&request.url.includes('/reasonlens_evaluation_runs'));
  assert.ok(evaluationWrite,'evaluation write request should be sent');
  assert.equal(evaluationWrite.body.workspace_id,workspaceB,'evaluation writes must persist the requested workspace ID');
  assert.equal(evaluationWrite.body.id,evaluationB.id);

  console.log('Workspace isolation tests passed: cross-workspace reads are excluded and writes are stamped with the requested workspace.');
 } finally {
  globalThis.fetch=previousFetch;
  if(previousUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=previousUrl;
  if(previousKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=previousKey;
 }
}

main().catch(error=>{console.error(error);process.exitCode=1;});
