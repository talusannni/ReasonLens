import { NextResponse } from 'next/server';
import { runTrace } from '../../../lib/provider';
export async function POST(req:Request){try{const body=await req.json();if(typeof body.prompt!=='string'||!body.prompt.trim())return NextResponse.json({error:'prompt is required'},{status:400});return NextResponse.json(await runTrace(body.prompt,body.provider,body.model));}catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Unexpected error'},{status:500});}}
