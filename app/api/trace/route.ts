import { NextResponse } from 'next/server';
import { runTrace } from '../../../lib/provider';
import type { TraceMode } from '../../../lib/types';
export async function POST(req:Request){try{const body=await req.json();if(typeof body.prompt!=='string'||!body.prompt.trim())return NextResponse.json({error:'prompt is required'},{status:400});const mode:TraceMode=['chat','rag','agent'].includes(body.mode)?body.mode:'chat';return NextResponse.json(await runTrace(body.prompt,body.provider,body.model,mode));}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unexpected error'},{status:500});}}
