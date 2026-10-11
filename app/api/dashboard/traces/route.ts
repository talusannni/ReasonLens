import { NextResponse } from 'next/server';
import { resolveDashboardWorkspaceId } from '../../../../lib/dashboard-auth';
import { listTracePage } from '../../../../lib/trace-store';
import { enforceRateLimit,workspaceRateLimitScope } from '../../../../lib/rate-limit';

const allowed=(value:string|null,values:string[])=>value&&values.includes(value)?value:undefined;

export async function GET(req:Request){
  const workspaceId=await resolveDashboardWorkspaceId(req);
  if(!workspaceId)return NextResponse.json({error:'Dashboard authentication required'},{status:401});
  const limited=await enforceRateLimit(req,workspaceRateLimitScope(workspaceId,'dashboard-trace-list'),60,60);
  if(limited)return limited;
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
    },workspaceId);
    return NextResponse.json(result,{headers:{'Cache-Control':'no-store'}});
  }catch{return NextResponse.json({error:'Trace store unavailable'},{status:503});}
}
