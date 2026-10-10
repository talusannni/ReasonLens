import {NextResponse} from 'next/server';
import {saveTrace,listTraces} from '../../../lib/trace-store';
import {constantTimeSecretEquals,readJsonBody} from '../../../lib/api-security';
import type {Trace} from '../../../lib/types';

function authorized(req:Request):boolean{
 return constantTimeSecretEquals(process.env.REASONLENS_INGEST_KEY,req.headers.get('authorization')?.replace(/^Bearer\s+/i,''));
}

function validTrace(value:unknown):value is Trace{
 if(!value||typeof value!=='object')return false;
 const t=value as Partial<Trace>;
 const metrics=t.metrics as Trace['metrics']|undefined;
 return typeof t.id==='string'&&t.id.length>0&&t.id.length<=100&&
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
 if(!authorized(req))return NextResponse.json({error:'Unauthorized'},{status:401});
 try{return NextResponse.json({traces:await listTraces()},{headers:{'Cache-Control':'no-store'}});}
 catch{return NextResponse.json({error:'Trace store unavailable'},{status:503});}
}

export async function POST(req:Request){
 if(!authorized(req))return NextResponse.json({error:'Unauthorized'},{status:401});
 const parsed=await readJsonBody(req,1024*1024);
 if(!parsed.ok)return NextResponse.json({error:parsed.error},{status:parsed.status});
 if(!validTrace(parsed.value))return NextResponse.json({error:'Invalid trace payload'},{status:400});
 try{
  await saveTrace(parsed.value);
  return NextResponse.json({id:parsed.value.id,status:'accepted'},{status:202});
 }catch{
  return NextResponse.json({error:'Trace store unavailable'},{status:503});
 }
}
