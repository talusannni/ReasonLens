import {NextResponse} from 'next/server';
import {dashboardWorkspaceId} from '../../../../../lib/dashboard-auth';
import {deleteTrace} from '../../../../../lib/trace-store';
import {enforceRateLimit,workspaceRateLimitScope} from '../../../../../lib/rate-limit';

export async function DELETE(req:Request,{params}:{params:Promise<{id:string}>}){
 const workspaceId=dashboardWorkspaceId(req);
 if(!workspaceId)return NextResponse.json({error:'Dashboard authentication required'},{status:401});
 const limited=await enforceRateLimit(req,workspaceRateLimitScope(workspaceId,'trace-delete'),10,60);
 if(limited)return limited;
 const {id}=await params;
 if(!/^[0-9a-f-]{36}$/i.test(id))return NextResponse.json({error:'Invalid trace ID'},{status:400});
 try{
  const deleted=await deleteTrace(id,workspaceId);
  return deleted
   ?NextResponse.json({deleted:true},{headers:{'Cache-Control':'no-store'}})
   :NextResponse.json({error:'Trace not found'},{status:404});
 }catch{
  return NextResponse.json({error:'Trace deletion unavailable'},{status:503});
 }
}
