import {NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {runTrace} from '../../../lib/provider';
import {getTrace,saveTrace} from '../../../lib/trace-store';
import {dashboardWorkspaceId} from '../../../lib/dashboard-auth';
import {readJsonBody} from '../../../lib/api-security';
import type {TraceMode} from '../../../lib/types';

export async function POST(req:Request){
 const parsed=await readJsonBody(req,64*1024);
 if(!parsed.ok)return NextResponse.json({error:parsed.error},{status:parsed.status});
 const body=parsed.value as Record<string,unknown>|null;
 if(!body||typeof body!=='object'||typeof body.prompt!=='string'||!body.prompt.trim()){
  return NextResponse.json({error:'prompt is required'},{status:400});
 }
 const prompt=body.prompt.trim();
 if(prompt.length>12000)return NextResponse.json({error:'prompt must be 12000 characters or fewer'},{status:413});
 const provider=body.provider===undefined?'mock':body.provider;
 if(provider!=='mock'&&provider!=='groq')return NextResponse.json({error:'provider must be mock or groq'},{status:400});
 const workspaceId=dashboardWorkspaceId(req);
 const persistTrace=workspaceId!==null;
 if(provider==='groq'&&process.env.NODE_ENV==='production'&&!persistTrace){
  return NextResponse.json({error:'Connect to the ReasonLens dashboard before using the hosted Groq provider'},{status:401});
 }
 if(body.model!==undefined&&(typeof body.model!=='string'||body.model.length>200)){
  return NextResponse.json({error:'model must be a string of at most 200 characters'},{status:400});
 }
 const mode:TraceMode=body.mode==='chat'||body.mode==='rag'||body.mode==='agent'?body.mode:'chat';
 const requestedParent=typeof body.parentTraceId==='string'&&body.parentTraceId.trim()?body.parentTraceId.trim():undefined;
 if(requestedParent&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedParent)){
  return NextResponse.json({error:'parentTraceId must be a valid trace UUID'},{status:400});
 }
 if(requestedParent&&!persistTrace)return NextResponse.json({error:'Connect to the ReasonLens dashboard to create a persisted variant'},{status:401});
 try{
  const parent=requestedParent&&workspaceId?await getTrace(requestedParent,workspaceId):undefined;
  if(requestedParent&&!parent)return NextResponse.json({error:'Parent trace not found'},{status:404});
  const trace=await runTrace(prompt,provider,typeof body.model==='string'?body.model:undefined,mode);
  const configFingerprint=createHash('sha256').update(JSON.stringify({prompt:trace.prompt,provider:trace.provider,model:trace.model,mode:trace.mode})).digest('hex').slice(0,16);
  trace.lineage={
   workflowId:parent?.lineage?.workflowId||parent?.id||trace.id,
   ...(parent?{parentTraceId:parent.id,experimentId:parent.lineage?.workflowId||parent.id}:{}),
   configFingerprint
  };
  if(persistTrace&&workspaceId)await saveTrace(trace,workspaceId);
  return NextResponse.json(trace,{headers:{'Cache-Control':'no-store'}});
 }catch(e){
  return NextResponse.json({error:e instanceof Error?e.message:'Trace execution failed'},{status:503});
 }
}
