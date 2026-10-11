import {NextResponse} from 'next/server';
import {saveTrace,listTraces,getTrace} from '../../../lib/trace-store';
import {readJsonBody} from '../../../lib/api-security';
import {resolveWorkspaceForCredential} from '../../../lib/workspace-auth';
import {enforceWorkspaceRateLimit} from '../../../lib/rate-limit-response';
import type {Trace} from '../../../lib/types';

async function authorized(req:Request):Promise<string|null>{
 const credential=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'').trim();
 return resolveWorkspaceForCredential(credential);
}

function isUuid(value:unknown):value is string{
 return typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function validTrace(value:unknown):value is Trace{
 if(!value||typeof value!=='object')return false;
 const t=value as Partial<Trace>;
 const metrics=t.metrics as Trace['metrics']|undefined;
 const lineage=t.lineage as Trace['lineage']|undefined;
 const lineageValid=t.lineage===undefined||(
  !!lineage&&typeof lineage==='object'&&
  (lineage.workflowId===undefined||isUuid(lineage.workflowId))&&
  (lineage.parentTraceId===undefined||isUuid(lineage.parentTraceId))&&
  (lineage.experimentId===undefined||isUuid(lineage.experimentId))&&
  (lineage.configFingerprint===undefined||(typeof lineage.configFingerprint==='string'&&lineage.configFingerprint.length<=128))
 );
 return lineageValid&&typeof t.id==='string'&&t.id.length>0&&t.id.length<=100&&
  typeof t.createdAt==='string'&&Number.isFinite(Date.parse(t.createdAt))&&
  typeof t.provider==='string'&&t.provider.length<=100&&
  typeof t.model==='string'&&t.model.length<=200&&
  typeof t.prompt==='string'&&t.prompt.length<=20000&&
  typeof t.answer==='string'&&t.answer.length<=100000&&
  (t.mode==='chat'||t.mode==='rag'||t.mode==='agent')&&
  (t.status==='completed'||t.status==='failed'||t.status==='running')&&
  Array.isArray(t.nodes)&&t.nodes.length<=5000&&Array.isArray(t.edges)&&t.edges.length<=10000&&
  !!metrics&&Number.isFinite(metrics.latencyMs)&&metrics.latencyMs>=0&&
  Number.isFinite(metrics.inputTokens)&&metrics.inputTokens>=0&&
  Number.isFinite(metrics.outputTokens)&&metrics.outputTokens>=0&&
  Number.isFinite(metrics.estimatedCostUsd)&&metrics.estimatedCostUsd>=0;
}

export async function GET(req:Request){
 const workspaceId=await authorized(req);
 if(!workspaceId)return NextResponse.json({error:'Unauthorized'},{status:401});
 const limited=await enforceWorkspaceRateLimit(workspaceId,'trace-read',60,300);
 if(limited)return limited;
 try{return NextResponse.json({traces:await listTraces(workspaceId)},{headers:{'Cache-Control':'no-store'}});}
 catch{return NextResponse.json({error:'Trace store unavailable'},{status:503});}
}

export async function POST(req:Request){
 const workspaceId=await authorized(req);
 if(!workspaceId)return NextResponse.json({error:'Unauthorized'},{status:401});
 const limited=await enforceWorkspaceRateLimit(workspaceId,'trace-ingest',60,120);
 if(limited)return limited;
 const quota=await enforceWorkspaceRateLimit(workspaceId,'trace-ingest-daily',86400,10000);
 if(quota)return quota;
 const parsed=await readJsonBody(req,1024*1024);
 if(!parsed.ok)return NextResponse.json({error:parsed.error},{status:parsed.status});
 if(!validTrace(parsed.value))return NextResponse.json({error:'Invalid trace payload'},{status:400});
 try{
  const parentTraceId=parsed.value.lineage?.parentTraceId;
  if(parentTraceId&&!await getTrace(parentTraceId,workspaceId)){
   return NextResponse.json({error:'Parent trace not found in this workspace'},{status:404});
  }
  await saveTrace(parsed.value,workspaceId);
  return NextResponse.json({id:parsed.value.id,status:'accepted'},{status:202});
 }catch{
  return NextResponse.json({error:'Trace store unavailable'},{status:503});
 }
}
