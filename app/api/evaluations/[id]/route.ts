import {NextResponse} from 'next/server';
import {getEvaluationRun,deleteEvaluationRun} from '../../../../lib/evaluation-store';
import {resolveDashboardWorkspaceId} from '../../../../lib/dashboard-auth';
import {enforceRateLimit,workspaceRateLimitScope} from '../../../../lib/rate-limit';

export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 const workspaceId=await resolveDashboardWorkspaceId(req);
 if(!workspaceId)return NextResponse.json({error:'Dashboard authentication required'},{status:401});
 const limited=await enforceRateLimit(req,workspaceRateLimitScope(workspaceId,'evaluation-detail'),60,60);
 if(limited)return limited;
 try{
  const {id}=await params;
  const run=await getEvaluationRun(id,workspaceId);
  if(!run)return NextResponse.json({error:'Evaluation run not found'},{status:404});
  return NextResponse.json({run},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Evaluation unavailable'},{status:503});}
}

export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){
 const workspaceId=await resolveDashboardWorkspaceId(req);
 if(!workspaceId)return NextResponse.json({error:'Dashboard authentication required'},{status:401});
 const limited=await enforceRateLimit(req,workspaceRateLimitScope(workspaceId,'evaluation-delete'),10,60);
 if(limited)return limited;
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:'Invalid evaluation ID'},{status:400});
 try{
  const deleted=await deleteEvaluationRun(id,workspaceId);
  return deleted
   ?NextResponse.json({deleted:true},{headers:{'Cache-Control':'no-store'}})
   :NextResponse.json({error:'Evaluation run not found'},{status:404});
 }catch{return NextResponse.json({error:'Evaluation deletion unavailable'},{status:503});}
}
