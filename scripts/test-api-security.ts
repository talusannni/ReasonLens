import assert from 'node:assert/strict';
import {constantTimeSecretEquals,readJsonBody} from '../lib/api-security';
import {createDashboardSession,createTeamDashboardSession,dashboardWorkspaceId,resolveDashboardWorkspaceId} from '../lib/dashboard-auth';
import {DEFAULT_WORKSPACE_ID,resolveWorkspaceForCredential} from '../lib/workspace-auth';

async function main(){
 assert.equal(constantTimeSecretEquals('secret','secret'),true,'matching secrets should pass');
 assert.equal(constantTimeSecretEquals('secret','wrong'),false,'different secrets should fail');
 assert.equal(constantTimeSecretEquals(undefined,'secret'),false,'missing configured secret should fail closed');
 assert.equal(constantTimeSecretEquals('secret',undefined),false,'missing supplied secret should fail closed');

 const previousSessionSecret=process.env.REASONLENS_SESSION_SECRET;
 process.env.REASONLENS_SESSION_SECRET='workspace-session-test-secret';
 const session=createDashboardSession(DEFAULT_WORKSPACE_ID);
 assert.equal(dashboardWorkspaceId(new Request('https://reasonlens.test',{headers:{cookie:'reasonlens_dashboard='+session}})),DEFAULT_WORKSPACE_ID,'valid workspace session should resolve its workspace');
 assert.equal(dashboardWorkspaceId(new Request('https://reasonlens.test',{headers:{cookie:'reasonlens_dashboard='+DEFAULT_WORKSPACE_ID+'.invalid'}})),null,'invalid workspace session signature should fail closed');
 const expiredSession=createDashboardSession(DEFAULT_WORKSPACE_ID,-1);
 assert.equal(dashboardWorkspaceId(new Request('https://reasonlens.test',{headers:{cookie:'reasonlens_dashboard='+expiredSession}})),null,'expired workspace session should fail closed');

 const previousTeamUrl=process.env.SUPABASE_URL;
 const previousTeamServiceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const previousFetch=globalThis.fetch;
 process.env.SUPABASE_URL='https://reasonlens-test.supabase.co';
 process.env.SUPABASE_SERVICE_ROLE_KEY='service-role-test';
 const teamUserId='00000000-0000-4000-8000-000000000002';
 const teamSession=createTeamDashboardSession(DEFAULT_WORKSPACE_ID,teamUserId);
 globalThis.fetch=(async(input:RequestInfo|URL)=>{
  const url=String(input);
  if(url.includes('/reasonlens_workspace_members?'))return new Response(JSON.stringify([{workspace_id:DEFAULT_WORKSPACE_ID}]),{status:200});
  if(url.includes('/reasonlens_workspaces?'))return new Response(JSON.stringify([{id:DEFAULT_WORKSPACE_ID,status:'active'}]),{status:200});
  return new Response('not found',{status:404});
 }) as typeof fetch;
 assert.equal(await resolveDashboardWorkspaceId(new Request('https://reasonlens.test',{headers:{cookie:'reasonlens_team_session='+teamSession}})),DEFAULT_WORKSPACE_ID,'team session should resolve only with active membership');
 globalThis.fetch=(async(input:RequestInfo|URL)=>{
  const url=String(input);
  if(url.includes('/reasonlens_workspace_members?'))return new Response(JSON.stringify([]),{status:200});
  if(url.includes('/reasonlens_workspaces?'))return new Response(JSON.stringify([{id:DEFAULT_WORKSPACE_ID,status:'active'}]),{status:200});
  return new Response('not found',{status:404});
 }) as typeof fetch;
 assert.equal(await resolveDashboardWorkspaceId(new Request('https://reasonlens.test',{headers:{cookie:'reasonlens_team_session='+teamSession}})),null,'team session without membership should fail closed');
 const expiredTeamSession=createTeamDashboardSession(DEFAULT_WORKSPACE_ID,teamUserId,-1);
 assert.equal(await resolveDashboardWorkspaceId(new Request('https://reasonlens.test',{headers:{cookie:'reasonlens_team_session='+expiredTeamSession}})),null,'expired team session should fail closed');
 globalThis.fetch=previousFetch;
 if(previousTeamUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=previousTeamUrl;
 if(previousTeamServiceKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=previousTeamServiceKey;
 if(previousSessionSecret===undefined)delete process.env.REASONLENS_SESSION_SECRET;else process.env.REASONLENS_SESSION_SECRET=previousSessionSecret;

 const previousIngestKey=process.env.REASONLENS_INGEST_KEY;
 const previousSupabaseUrl=process.env.SUPABASE_URL;
 const previousServiceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 process.env.REASONLENS_INGEST_KEY='legacy-workspace-test-key';
 delete process.env.SUPABASE_URL;
 delete process.env.SUPABASE_SERVICE_ROLE_KEY;
 assert.equal(await resolveWorkspaceForCredential('legacy-workspace-test-key'),DEFAULT_WORKSPACE_ID,'legacy ingestion credential should map to the default workspace');
 delete process.env.SUPABASE_URL;
 delete process.env.SUPABASE_SERVICE_ROLE_KEY;
 assert.equal(await resolveWorkspaceForCredential('not-a-valid-workspace-key'),null,'unknown workspace credentials should fail closed without persistence configuration');
 if(previousIngestKey===undefined)delete process.env.REASONLENS_INGEST_KEY;else process.env.REASONLENS_INGEST_KEY=previousIngestKey;
 if(previousSupabaseUrl===undefined)delete process.env.SUPABASE_URL;else process.env.SUPABASE_URL=previousSupabaseUrl;
 if(previousServiceKey===undefined)delete process.env.SUPABASE_SERVICE_ROLE_KEY;else process.env.SUPABASE_SERVICE_ROLE_KEY=previousServiceKey;

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
