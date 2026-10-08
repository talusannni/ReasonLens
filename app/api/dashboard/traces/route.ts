import { NextResponse } from 'next/server';
import { createHash, timingSafeEqual } from 'crypto';
import { listTraces } from '../../../../lib/trace-store';

function authorized(req:Request){
  const expected=process.env.REASONLENS_INGEST_KEY;
  const supplied=req.headers.get('cookie')?.match(/(?:^|; )reasonlens_dashboard=([^;]+)/)?.[1];
  if(!expected||!supplied)return false;
  const a=Buffer.from(supplied);
  const b=Buffer.from(createHash('sha256').update(expected).digest('hex'));
  return a.length===b.length&&timingSafeEqual(a,b);
}

export async function GET(req:Request){
  if(!authorized(req))return NextResponse.json({error:'Dashboard authentication required'},{status:401});
  try{return NextResponse.json({traces:await listTraces()},{headers:{'Cache-Control':'no-store'}});}
  catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Trace store unavailable'},{status:503});}
}
