import {createHmac,timingSafeEqual} from 'node:crypto';

const SESSION_TTL_SECONDS=60*60*24*7;
const UUID_PATTERN=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sessionSecret(){return process.env.REASONLENS_SESSION_SECRET||process.env.REASONLENS_INGEST_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'';}
function sign(value:string){const secret=sessionSecret();return secret?createHmac('sha256',secret).update(value).digest('hex'):'';}
function safeEquals(a:string,b:string){
 const left=Buffer.from(a);const right=Buffer.from(b);
 return left.length===right.length&&timingSafeEqual(left,right);
}
function cookieValue(req:Request,name:string){
 const escaped=name.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return req.headers.get('cookie')?.match(new RegExp('(?:^|;\\s*)'+escaped+'=([^;]*)'))?.[1]||null;
}

export function createDashboardSession(workspaceId:string,ttlSeconds=SESSION_TTL_SECONDS):string{
 const expiresAt=Math.floor(Date.now()/1000)+ttlSeconds;
 const payload=workspaceId+'.'+expiresAt;
 const signature=sign(payload);
 if(!signature)throw new Error('Dashboard session signing is not configured.');
 return payload+'.'+signature;
}

export function createTeamDashboardSession(workspaceId:string,userId:string,ttlSeconds=SESSION_TTL_SECONDS):string{
 if(!UUID_PATTERN.test(workspaceId)||!UUID_PATTERN.test(userId))throw new Error('Invalid team session identity.');
 const expiresAt=Math.floor(Date.now()/1000)+ttlSeconds;
 const payload=workspaceId+'.'+userId+'.'+expiresAt;
 const signature=sign(payload);
 if(!signature)throw new Error('Dashboard session signing is not configured.');
 return payload+'.'+signature;
}

export function dashboardWorkspaceId(req:Request):string|null{
 const supplied=cookieValue(req,'reasonlens_dashboard');
 if(!supplied)return null;
 const parts=supplied.split('.');
 if(parts.length!==3)return null;
 const [workspaceId,expiresText,signature]=parts;
 if(!UUID_PATTERN.test(workspaceId)||!/^\d{10}$/.test(expiresText))return null;
 const expiresAt=Number(expiresText);
 if(!Number.isSafeInteger(expiresAt)||expiresAt<=Math.floor(Date.now()/1000))return null;
 const expected=sign(workspaceId+'.'+expiresText);
 return expected&&safeEquals(signature,expected)?workspaceId:null;
}

/**
 * Resolves team sessions against current database membership on every request.
 * Legacy workspace-key sessions remain supported during the migration.
 */
export async function resolveDashboardWorkspaceId(req:Request):Promise<string|null>{
 const supplied=cookieValue(req,'reasonlens_team_session');
 if(supplied){
  const parts=supplied.split('.');
  if(parts.length!==4)return null;
  const [workspaceId,userId,expiresText,signature]=parts;
  if(!UUID_PATTERN.test(workspaceId)||!UUID_PATTERN.test(userId)||!/^\d{10}$/.test(expiresText))return null;
  const expiresAt=Number(expiresText);
  if(!Number.isSafeInteger(expiresAt)||expiresAt<=Math.floor(Date.now()/1000))return null;
  const expected=sign(workspaceId+'.'+userId+'.'+expiresText);
  if(!expected||!safeEquals(signature,expected))return null;
  const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
  const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!key)return null;
  try{
   const headers={'apikey':key,'Authorization':'Bearer '+key};
   const membershipQuery=new URLSearchParams({select:'workspace_id',workspace_id:'eq.'+workspaceId,user_id:'eq.'+userId,limit:'1'});
   const membershipResponse=await fetch(url+'/rest/v1/reasonlens_workspace_members?'+membershipQuery.toString(),{headers,cache:'no-store'});
   if(!membershipResponse.ok)return null;
   const memberships=await membershipResponse.json();
   if(!Array.isArray(memberships)||!memberships.some((m:unknown)=>!!m&&typeof m==='object'&&(m as {workspace_id?:unknown}).workspace_id===workspaceId))return null;
   const workspaceQuery=new URLSearchParams({select:'id,status',id:'eq.'+workspaceId,limit:'1'});
   const workspaceResponse=await fetch(url+'/rest/v1/reasonlens_workspaces?'+workspaceQuery.toString(),{headers,cache:'no-store'});
   if(!workspaceResponse.ok)return null;
   const workspaces=await workspaceResponse.json();
   return Array.isArray(workspaces)&&workspaces[0]?.id===workspaceId&&workspaces[0]?.status==='active'?workspaceId:null;
  }catch{return null;}
 }
 return dashboardWorkspaceId(req);
}

export function dashboardAuthorized(req:Request):boolean{
 return dashboardWorkspaceId(req)!==null;
}
