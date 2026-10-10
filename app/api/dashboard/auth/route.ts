import {NextResponse} from 'next/server';
import {readJsonBody} from '../../../../lib/api-security';
import {createTeamDashboardSession} from '../../../../lib/dashboard-auth';
import {firstActiveWorkspaceForUser,signInWithPassword} from '../../../../lib/team-auth-service';

const SESSION_MAX_AGE=60*60*24*7;
function setSession(response:ReturnType<typeof NextResponse.json>,workspaceId:string,userId:string){
 response.cookies.set('reasonlens_team_session',createTeamDashboardSession(workspaceId,userId),{
  httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:SESSION_MAX_AGE
 });
 response.cookies.set('reasonlens_dashboard','',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:0});
 return response;
}

export async function POST(req:Request){
 const parsed=await readJsonBody(req,16*1024);
 if(!parsed.ok)return NextResponse.json({error:parsed.error},{status:parsed.status});
 const body=parsed.value as Record<string,unknown>|null;
 if(!body||typeof body.email!=='string'||typeof body.password!=='string'||
  body.email.trim().length<3||body.email.trim().length>320||body.password.length<8||body.password.length>128){
  return NextResponse.json({error:'Provide a valid email and password (8–128 characters).'}, {status:400});
 }
 try{
  const identity=await signInWithPassword(body.email.trim().toLowerCase(),body.password);
  if(!identity)return NextResponse.json({error:'Invalid email or password.'},{status:401});
  const workspaceId=await firstActiveWorkspaceForUser(identity.userId);
  if(!workspaceId)return NextResponse.json({error:'This account is not assigned to an active workspace.'},{status:403});
  return setSession(NextResponse.json({ok:true,workspaceId},{headers:{'Cache-Control':'no-store'}}),workspaceId,identity.userId);
 }catch(e){
  return NextResponse.json({error:e instanceof Error&&e.message==='Supabase Auth is not configured'?'Team authentication is not configured.':'Authentication service unavailable.'},{status:503});
 }
}

export async function DELETE(){
 const response=NextResponse.json({ok:true},{headers:{'Cache-Control':'no-store'}});
 response.cookies.set('reasonlens_team_session','',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:0});
 response.cookies.set('reasonlens_dashboard','',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:0});
 return response;
}
