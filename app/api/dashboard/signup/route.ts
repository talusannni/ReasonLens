import {NextResponse} from 'next/server';
import {readJsonBody} from '../../../../lib/api-security';
import {createTeamDashboardSession} from '../../../../lib/dashboard-auth';
import {createWorkspaceForUser,signUpWithPassword} from '../../../../lib/team-auth-service';

const SESSION_MAX_AGE=60*60*24*7;

export async function POST(req:Request){
 const parsed=await readJsonBody(req,16*1024);
 if(!parsed.ok)return NextResponse.json({error:parsed.error},{status:parsed.status});
 const body=parsed.value as Record<string,unknown>|null;
 if(!body||typeof body.email!=='string'||typeof body.password!=='string'||
  body.email.trim().length<3||body.email.trim().length>320||body.password.length<8||body.password.length>128||
  (body.workspaceName!==undefined&&(typeof body.workspaceName!=='string'||body.workspaceName.trim().length>80))){
  return NextResponse.json({error:'Provide a valid email, password (8–128 characters), and optional workspace name (up to 80 characters).'}, {status:400});
 }
 try{
  const identity=await signUpWithPassword(body.email.trim().toLowerCase(),body.password);
  if(!identity)return NextResponse.json({error:'Could not create account. The email may already be registered or Supabase Auth rejected the request.'},{status:400});
  const workspaceName=typeof body.workspaceName==='string'&&body.workspaceName.trim()?body.workspaceName.trim():'Personal workspace';
  const workspaceId=await createWorkspaceForUser(identity.userId,workspaceName);
  if(!workspaceId)return NextResponse.json({error:'Account created, but workspace provisioning failed. Contact support before retrying signup.'},{status:503});
  const response=NextResponse.json({
   ok:true,
   workspaceId:identity.sessionReady?workspaceId:undefined,
   needsEmailConfirmation:!identity.sessionReady
  },{status:201,headers:{'Cache-Control':'no-store'}});
  if(identity.sessionReady){
   response.cookies.set('reasonlens_team_session',createTeamDashboardSession(workspaceId,identity.userId),{
    httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:SESSION_MAX_AGE
   });
   response.cookies.set('reasonlens_dashboard','',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:0});
  }
  return response;
 }catch(e){
  const message=e instanceof Error?e.message:'';
  return NextResponse.json({error:message==='Supabase Auth is not configured'?'Team authentication is not configured.':'Signup service unavailable.'},{status:503});
 }
}
