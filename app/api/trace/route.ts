import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { runTrace } from '../../../lib/provider';
import { getTrace, saveTrace } from '../../../lib/trace-store';
import type { TraceMode } from '../../../lib/types';

export async function POST(req:Request){
  try{
    const body=await req.json();
    if(typeof body.prompt!=='string'||!body.prompt.trim()){
      return NextResponse.json({error:'prompt is required'},{status:400});
    }
    const mode:TraceMode=['chat','rag','agent'].includes(body.mode)?body.mode:'chat';
    const requestedParent=typeof body.parentTraceId==='string'&&body.parentTraceId.trim()?body.parentTraceId.trim():undefined;
    if(requestedParent&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestedParent)){
      return NextResponse.json({error:'parentTraceId must be a valid trace UUID'},{status:400});
    }
    const parent=requestedParent?await getTrace(requestedParent):undefined;
    if(requestedParent&&!parent)return NextResponse.json({error:'Parent trace not found'},{status:404});
    const trace=await runTrace(body.prompt.trim(),body.provider,body.model,mode);
    const configFingerprint=createHash('sha256').update(JSON.stringify({
      prompt:trace.prompt,provider:trace.provider,model:trace.model,mode:trace.mode
    })).digest('hex').slice(0,16);
    trace.lineage={
      workflowId:parent?.lineage?.workflowId||parent?.id||trace.id,
      ...(parent?{parentTraceId:parent.id,experimentId:parent.lineage?.workflowId||parent.id}:{}),
      configFingerprint
    };
    await saveTrace(trace);
    return NextResponse.json(trace);
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:'Unexpected error'},{status:500});
  }
}
