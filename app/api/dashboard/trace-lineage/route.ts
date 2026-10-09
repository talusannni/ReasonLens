import { NextResponse } from 'next/server';
import { dashboardAuthorized } from '../../../../lib/dashboard-auth';
import { listTraceLineage } from '../../../../lib/trace-store';

export async function GET(req:Request){
 if(!dashboardAuthorized(req))return NextResponse.json({error:'Dashboard authentication required'},{status:401});
 try{
  const id=new URL(req.url).searchParams.get('traceId')||'';
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)){
   return NextResponse.json({error:'Invalid trace ID'},{status:400});
  }
  const traces=await listTraceLineage(id);
  if(!traces.length)return NextResponse.json({error:'Trace not found'},{status:404});
  return NextResponse.json({traces},{headers:{'Cache-Control':'no-store'}});
 }catch(e){
  return NextResponse.json({error:e instanceof Error?e.message:'Trace lineage unavailable'},{status:503});
 }
}
