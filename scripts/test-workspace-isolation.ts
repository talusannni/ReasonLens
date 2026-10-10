import assert from 'node:assert/strict';
import {getTrace,listTracePage} from '../lib/trace-store';
import {getEvaluationRun,listEvaluationRuns} from '../lib/evaluation-store';

async function main(){
 const previousUrl=process.env.SUPABASE_URL;
 const previousKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const previousFetch=globalThis.fetch;
 const workspaceA='00000000-0000-4000-8000-00000000000a';
 const workspaceB='00000000-0000-4000-8000-00000000000b';
 const seen:string[]=[];

 process.env.SUPABASE_URL='https://reasonlens-isolation-test.supabase.co';
 process.env.SUPABASE_SERVICE_ROLE_KEY='test-service-role';
 globalThis.fetch=(async(input:RequestInfo|URL)=>{
  const url=String(input);
  seen.push(url);
  return new Response('[]',{status:200,headers:{'Content-Type':'application/json','Content-Range':'0-0/0'}});
 }) as typeof fetch;

 try{
  await getTrace('trace-id',workspaceB);
  assert.ok(seen.at(-1)?.includes('workspace_id=eq.'+workspaceB),'trace lookup must filter by the requested workspace');
  assert.ok(!seen.at(-1)?.includes(workspaceA),'trace lookup must not query a different workspace');

  await listTracePage({page:1,pageSize:25},workspaceB);
  assert.ok(seen.at(-1)?.includes('workspace_id=eq.'+workspaceB),'trace list must filter by the requested workspace');

  await listEvaluationRuns(workspaceB);
  assert.ok(seen.at(-1)?.includes('workspace_id=eq.'+workspaceB),'evaluation list must filter by the requested workspace');

  await getEvaluationRun('evaluation-id',workspaceB);
  assert.ok(seen.at(-1)?.includes('workspace_id=eq.'+workspaceB),'evaluation lookup must filter by the requested workspace');

  // The store layer must return no records when the database has no rows for this workspace.
  assert.equal(await getTrace('trace-owned-by-a',workspaceB),undefined,'a trace outside workspace B must not be returned');
  assert.equal(await getEvaluationRun('evaluation-owned-by-a',workspaceB),undefined,'an evaluation outside workspace B must not be returned');

  console.log('Workspace isolation store tests passed (trace and evaluation reads are workspace-scoped).');
 } finally {
  globalThis.fetch=previousFetch;
  if(previousUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=previousUrl;
  if(previousKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=previousKey;
 }
}

main().catch(error=>{console.error(error);process.exitCode=1;});
