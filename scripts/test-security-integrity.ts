import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {resolveWorkspaceForCredential} from '../lib/workspace-auth';
import {getTrace,deleteTrace} from '../lib/trace-store';
import {getEvaluationRun,deleteEvaluationRun} from '../lib/evaluation-store';
import {rateLimitBucketKey} from '../lib/rate-limit';

/**
 * Security regression suite. All credentials below are deliberately fake,
 * test-only values. Never use production API keys or service-role secrets here.
 */
const teams = [
  {slug:'alpha', key:'rl_test_only_alpha_00000000000000000000000000000001', workspaceId:'00000000-0000-4000-8000-000000000101', status:'active', revoked:false},
  {slug:'bravo', key:'rl_test_only_bravo_00000000000000000000000000000002', workspaceId:'00000000-0000-4000-8000-000000000102', status:'active', revoked:false},
  {slug:'charlie', key:'rl_test_only_charlie_00000000000000000000000000000003', workspaceId:'00000000-0000-4000-8000-000000000103', status:'active', revoked:false},
  {slug:'disabled', key:'rl_test_only_disabled_000000000000000000000000000004', workspaceId:'00000000-0000-4000-8000-000000000104', status:'disabled', revoked:false},
  {slug:'revoked', key:'rl_test_only_revoked_000000000000000000000000000005', workspaceId:'00000000-0000-4000-8000-000000000105', status:'active', revoked:true}
] as const;

const traces = teams.slice(0,3).map((team,index)=>({
  id:'10000000-0000-4000-8000-00000000000'+(index+1),
  workspace_id:team.workspaceId,
  created_at:'2026-10-11T00:00:00.000Z',
  provider:'mock',model:'security-test',prompt:'private prompt '+team.slug,mode:'chat',answer:'private answer '+team.slug,
  status:'completed',metrics:{latencyMs:10,inputTokens:2,outputTokens:3,estimatedCostUsd:0},
  nodes:[],edges:[],workflow_id:'workflow-'+team.slug,parent_trace_id:null,experiment_id:null,config_fingerprint:null
}));

const evaluations = teams.slice(0,3).map((team,index)=>({
  id:'20000000-0000-4000-8000-00000000000'+(index+1),
  workspace_id:team.workspaceId,created_at:'2026-10-11T00:00:00.000Z',name:'private evaluation '+team.slug,
  dataset:[],results:[],summary:{totalCases:0,evaluatedCases:0,missingCases:0,passedCases:0,warnedCases:0,failedCases:0,passRate:0,averageProvenanceScore:0,totalLatencyMs:0,averageLatencyMs:0,totalCostUsd:0}
}));

const digest=(value:string)=>createHash('sha256').update(value).digest('hex');
const originalEnv={
  url:process.env.SUPABASE_URL,
  serviceKey:process.env.SUPABASE_SERVICE_ROLE_KEY,
  ingestKey:process.env.REASONLENS_INGEST_KEY,
  fetch:globalThis.fetch
};

async function main(){
  process.env.SUPABASE_URL='https://reasonlens-security-test.supabase.co';
  process.env.SUPABASE_SERVICE_ROLE_KEY='TEST_ONLY_NOT_A_REAL_SUPABASE_KEY';
  delete process.env.REASONLENS_INGEST_KEY;

  const requests:Array<{path:string;method:string;workspace:string|null;id:string|null}>=[];
  globalThis.fetch=(async(input:RequestInfo|URL,init?:RequestInit)=>{
    const raw=typeof input==='string'?input:input instanceof URL?input.href:input.url;
    const url=new URL(raw);
    const method=init?.method||'GET';
    const workspace=url.searchParams.get('workspace_id');
    const id=url.searchParams.get('id');
    requests.push({path:url.pathname,method,workspace,id});

    if(url.pathname.endsWith('/reasonlens_api_keys')){
      const requestedHash=(url.searchParams.get('key_hash')||'').replace(/^eq\./,'');
      const match=teams.find(team=>digest(team.key)===requestedHash&&!team.revoked);
      return Response.json(match?[{workspace_id:match.workspaceId}]:[]);
    }
    if(url.pathname.endsWith('/reasonlens_workspaces')){
      const workspaceId=(url.searchParams.get('id')||'').replace(/^eq\./,'');
      const match=teams.find(team=>team.workspaceId===workspaceId);
      return Response.json(match?[{id:match.workspaceId,status:match.status}]:[]);
    }
    if(url.pathname.endsWith('/reasonlens_traces')){
      const trace=traces.find(row=>row.id===(id||'').replace(/^eq\./,'')&&row.workspace_id===(workspace||'').replace(/^eq\./,''));
      if(method==='DELETE')return Response.json(trace?[{id:trace.id}]:[]);
      return Response.json(trace?[trace]:[]);
    }
    if(url.pathname.endsWith('/reasonlens_evaluation_runs')){
      const evaluation=evaluations.find(row=>row.id===(id||'').replace(/^eq\./,'')&&row.workspace_id===(workspace||'').replace(/^eq\./,''));
      if(method==='DELETE')return Response.json(evaluation?[{id:evaluation.id}]:[]);
      return Response.json(evaluation?[evaluation]:[]);
    }
    throw new Error('Unexpected request in security test: '+url.pathname);
  }) as typeof fetch;

  try{
    // Each fixed key is a synthetic fixture. Verify credentials cannot select a
    // different workspace by changing the request's claimed tenant.
    for(let i=0;i<3;i++){
      const team=teams[i];
      assert.equal(await resolveWorkspaceForCredential(team.key),team.workspaceId,team.slug+' key should resolve only to its own workspace');
    }
    assert.equal(await resolveWorkspaceForCredential('rl_test_only_unknown_key'),null,'unknown keys must be rejected');
    assert.equal(await resolveWorkspaceForCredential(teams[3].key),null,'disabled workspaces must be rejected');
    assert.equal(await resolveWorkspaceForCredential(teams[4].key),null,'revoked keys must be rejected');
    assert.equal(await resolveWorkspaceForCredential('x'.repeat(513)),null,'oversized credentials must be rejected');

    // Read and delete checks: IDs are deliberately known to all test callers.
    // The data layer must still require the matching workspace filter.
    for(let i=0;i<3;i++){
      const owner=teams[i];
      const ownTrace=await getTrace(traces[i].id,owner.workspaceId);
      assert.equal(ownTrace?.id,traces[i].id,owner.slug+' should read its own trace');
      const ownEvaluation=await getEvaluationRun(evaluations[i].id,owner.workspaceId);
      assert.equal(ownEvaluation?.id,evaluations[i].id,owner.slug+' should read its own evaluation');

      for(let j=0;j<3;j++){
        if(i===j)continue;
        assert.equal(await getTrace(traces[i].id,teams[j].workspaceId),undefined,teams[j].slug+' must not read '+owner.slug+' trace');
        assert.equal(await getEvaluationRun(evaluations[i].id,teams[j].workspaceId),undefined,teams[j].slug+' must not read '+owner.slug+' evaluation');
        assert.equal(await deleteTrace(traces[i].id,teams[j].workspaceId),false,teams[j].slug+' must not delete '+owner.slug+' trace');
        assert.equal(await deleteEvaluationRun(evaluations[i].id,teams[j].workspaceId),false,teams[j].slug+' must not delete '+owner.slug+' evaluation');
      }
      assert.equal(await deleteTrace(traces[i].id,owner.workspaceId),true,owner.slug+' should delete its own trace');
      assert.equal(await deleteEvaluationRun(evaluations[i].id,owner.workspaceId),true,owner.slug+' should delete its own evaluation');
    }

    assert.notEqual(rateLimitBucketKey('workspace:'+teams[0].workspaceId+':trace-write'),rateLimitBucketKey('workspace:'+teams[1].workspaceId+':trace-write'),'teams must have separate rate-limit buckets');
    assert.notEqual(rateLimitBucketKey('workspace:'+teams[1].workspaceId+':trace-write'),rateLimitBucketKey('workspace:'+teams[2].workspaceId+':trace-write'),'all teams must have isolated rate-limit buckets');

    const dataRequests=requests.filter(r=>r.path.endsWith('/reasonlens_traces')||r.path.endsWith('/reasonlens_evaluation_runs'));
    assert(dataRequests.length>0,'suite should exercise persistent data access');
    assert(dataRequests.every(r=>!!r.workspace&&r.workspace.startsWith('eq.')),'every trace/evaluation read or delete must be workspace-scoped');
    assert(requests.filter(r=>r.path.endsWith('/reasonlens_api_keys')).every(r=>r.method==='GET'),'API key verification must not mutate API key records');

    console.log('Security/integrity suite passed: 3 isolated teams, credential lifecycle, disabled workspace, unknown/oversized keys, trace/evaluation read-delete isolation, and rate-limit namespace separation.');
  }finally{
    globalThis.fetch=originalEnv.fetch;
    if(originalEnv.url===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=originalEnv.url;
    if(originalEnv.serviceKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=originalEnv.serviceKey;
    if(originalEnv.ingestKey===undefined)delete process.env.REASONLENS_INGEST_KEY;else process.env.REASONLENS_INGEST_KEY=originalEnv.ingestKey;
  }
}

main().catch(error=>{console.error(error);process.exitCode=1;});
