import { NextResponse } from 'next/server';
import { runTrace } from '../../../lib/provider';
import { saveTrace } from '../../../lib/trace-store';
import type { TraceMode } from '../../../lib/types';

export async function POST(req:Request){
  try{
    const body=await req.json();
    if(typeof body.prompt!=='string'||!body.prompt.trim()){
      return NextResponse.json({error:'prompt is required'},{status:400});
    }
    const mode:TraceMode=['chat','rag','agent'].includes(body.mode)?body.mode:'chat';
    const trace=await runTrace(body.prompt,body.provider,body.model,mode);
    await saveTrace(trace);
    return NextResponse.json(trace);
  }catch(e){
    return NextResponse.json({error:e instanceof Error?e.message:'Unexpected error'},{status:500});
  }
}
