import {NextResponse} from 'next/server';
import {saveTrace,listTraces} from '../../../lib/trace-store';
import type {Trace} from '../../../lib/types';

function validTrace(value:unknown):value is Trace{
 const t=value as Trace;
 return !!t&&typeof t==='object'&&typeof t.id==='string'&&typeof t.createdAt==='string'&&typeof t.prompt==='string'&&Array.isArray(t.nodes)&&Array.isArray(t.edges)&&typeof t.answer==='string'&&!!t.metrics;
}

export async function GET(){return NextResponse.json({traces:listTraces()});}

export async function POST(req:Request){
 try{
  const body=await req.json();
  if(!validTrace(body))return NextResponse.json({error:'Invalid trace payload'},{status:400});
  saveTrace(body);
  return NextResponse.json({id:body.id,status:'accepted'}, {status:202});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Invalid JSON'},{status:400});}
}
