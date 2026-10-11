import {NextResponse} from 'next/server';
import {getEvaluationRun} from '../../../../lib/evaluation-store';
import {dashboardWorkspaceId} from '../../../../lib/dashboard-auth';
import {enforceWorkspaceRateLimit} from '../../../../lib/rate-limit-response';

export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 const workspaceId=dashboardWorkspaceId(req);
 if(!workspaceId)return NextResponse.json({error:'Dashboard authentication required'},{status:401});
 const limited=await enforceWorkspaceRateLimit(workspaceId,'evaluation-read',60,120);
 if(limited)return limited;
 try{
  const {id}=await params;
  const run=await getEvaluationRun(id,workspaceId);
  if(!run)return NextResponse.json({error:'Evaluation run not found'},{status:404});
  return NextResponse.json({run},{headers:{'Cache-Control':'no-store'}});
 }catch{return NextResponse.json({error:'Evaluation unavailable'},{status:503});}
}
