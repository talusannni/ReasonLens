import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import { listTracePage } from '../../../../lib/trace-store';

function authorized(req:Request){
  const expected=process.env.REASONLENS_INGEST_KEY;
  const supplied=req.headers.get('cookie')?.match(/(?:^|; )reasonlens_dashboard=([^;]+)/)?.[1];
  if(!expected||!supplied)return false;
  const a=Buffer.from(supplied);
  const b=Buffer.from(createHash('sha256').update(expected).digest('hex'));
  return a.length===b.length&&timingSafeEqual(a,b);
}

const allowed=(value:string|null,values:string[])=>value&&values.includes(value)?value:undefined;

export async function GET(req:Request){
  if(!authorized(req))return NextResponse.json({error:'Dashboard authentication required'},{status:401});
  try{
    const params=new URL(req.url).searchParams;
    const page=Math.min(100000,Math.max(1,Number.parseInt(params.get('page')||'1',10)||1));
    const pageSize=Math.min(100,Math.max(10,Number.parseInt(params.get('pageSize')||'25',10)||25));
    const days=allowed(params.get('days'),['1','7','30']);
    const since=days?new Date(Date.now()-Number(days)*24*60*60*1000).toISOString():undefined;
    const result=await listTracePage({
      page,pageSize,
      search:params.get('search')||undefined,
      mode:allowed(params.get('mode'),['chat','rag','agent']),
      status:allowed(params.get('status'),['completed','failed','running']),
      provider:params.get('provider')||undefined,
      model:params.get('model')||undefined,
      since,
      sort:allowed(params.get('sort'),['newest','oldest','latency-desc','latency-asc','cost-desc','cost-asc'])||'newest',
      execution:allowed(params.get('execution'),['retrieval-only','full-pipeline','llm-executed','partial','no-llm'])||undefined
    });
    return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
  }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Trace store unavailable'},{status:503});}
}
