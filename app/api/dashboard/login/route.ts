import {NextResponse} from 'next/server';
import {readJsonBody} from '../../../../lib/api-security';
import {createDashboardSession} from '../../../../lib/dashboard-auth';
import {markWorkspaceCredentialUsed,resolveWorkspaceForCredential} from '../../../../lib/workspace-auth';

export async function POST(req:Request){
 const parsed=await readJsonBody(req,16*1024);
 if(!parsed.ok)return NextResponse.json({error:parsed.error},{status:parsed.status});
 const body=parsed.value as Record<string,unknown>|null;
 if(!body||typeof body!=='object'||typeof body.key!=='string'||!body.key.trim()){
  return NextResponse.json({error:'Invalid dashboard key'},{status:401});
 }
 const credential=body.key.trim();
 const workspaceId=await resolveWorkspaceForCredential(credential);
 if(!workspaceId){
  if(!process.env.REASONLENS_INGEST_KEY&&!process.env.SUPABASE_SERVICE_ROLE_KEY){
   return NextResponse.json({error:'Dashboard authentication is not configured'},{status:503});
  }
  return NextResponse.json({error:'Invalid dashboard key'},{status:401});
 }
 try{
  await markWorkspaceCredentialUsed(credential);
  const response=NextResponse.json({ok:true,workspaceId},{headers:{'Cache-Control':'no-store'}});
  response.cookies.set('reasonlens_dashboard',createDashboardSession(workspaceId),{
   httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:60*60*24*7
  });
  return response;
 }catch{
  return NextResponse.json({error:'Dashboard authentication is not configured'},{status:503});
 }
}

export async function DELETE(){
 const response=NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 response.cookies.set('reasonlens_dashboard','',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:0});
 return response;
}
