import {randomUUID} from 'node:crypto';

type AuthUser={id?:string;email?:string;identities?:unknown[]};
type SupabaseAuthResponse={access_token?:string;user?:AuthUser;id?:string;email?:string;msg?:string;message?:string;error_description?:string;error?:string;code?:string};

function config(){
 const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
 const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
 const anonKey=process.env.SUPABASE_ANON_KEY||process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
 if(!url||!serviceKey||!anonKey)throw new Error('Supabase Auth is not configured.');
 return {url,serviceKey,anonKey};
}
function serviceHeaders(key:string){return {'apikey':key,'Authorization':'Bearer '+key,'Content-Type':'application/json'};}
async function responseJson(response:Response):Promise<Record<string,unknown>>{
 try{const value=await response.json();return value&&typeof value==='object'?value as Record<string,unknown>:{};}catch{return {};}
}
function authUser(value:SupabaseAuthResponse):AuthUser|null{
 const candidate=value.user&&typeof value.user==='object'?value.user:value;
 return candidate&&typeof candidate.id==='string'?candidate:null;
}
function safeErrorCode(value:Record<string,unknown>):string|undefined{
 const candidate=value.code??value.error_code??value.error;
 return typeof candidate==='string'&&/^[A-Za-z0-9_.-]{1,80}$/.test(candidate)?candidate:undefined;
}

export async function signInWithPassword(email:string,password:string):Promise<{userId:string}|null>{
 const {url,anonKey}=config();
 const response=await fetch(url+'/auth/v1/token?grant_type=password',{
  method:'POST',headers:serviceHeaders(anonKey),body:JSON.stringify({email,password}),cache:'no-store'
 });
 const data=await responseJson(response) as SupabaseAuthResponse;
 if(!response.ok||!authUser(data))return null;
 return {userId:authUser(data)!.id!};
}

export async function signUpWithPassword(email:string,password:string):Promise<{userId:string;sessionReady:boolean}|null>{
 const {url,anonKey}=config();
 const response=await fetch(url+'/auth/v1/signup',{
  method:'POST',headers:serviceHeaders(anonKey),body:JSON.stringify({email,password}),cache:'no-store'
 });
 const data=await responseJson(response) as SupabaseAuthResponse;
 if(!response.ok)return null;
 const user=authUser(data);
 if(!user||(Array.isArray(user.identities)&&user.identities.length===0))return null;
 return {userId:user.id!,sessionReady:typeof data.access_token==='string'&&data.access_token.length>0};
}

export async function createWorkspaceForUser(userId:string,workspaceName:string):Promise<string|null>{
 const {url,serviceKey}=config();
 const safeName=workspaceName.trim().slice(0,80)||'Personal workspace';
 const base=safeName.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,42)||'workspace';
 const slug=base+'-'+randomUUID().replace(/-/g,'').slice(0,8);
 const headers=serviceHeaders(serviceKey);
 const workspaceResponse=await fetch(url+'/rest/v1/reasonlens_workspaces',{
  method:'POST',headers:{...headers,Prefer:'return=representation'},
  body:JSON.stringify({id:randomUUID(),name:safeName,slug,status:'active'}),cache:'no-store'
 });
 const workspaceRows=await responseJsonArray(workspaceResponse);
 const workspaceRow=workspaceRows[0];
 if(!workspaceResponse.ok||!workspaceRow||typeof workspaceRow.id!=='string'){
  console.error('[ReasonLens signup] workspace_insert_failed',JSON.stringify({status:workspaceResponse.status,code:workspaceRows.errorCode}));
  return null;
 }
 const workspaceId=workspaceRow.id;
 const memberResponse=await fetch(url+'/rest/v1/reasonlens_workspace_members',{
  method:'POST',headers:{...headers,Prefer:'return=minimal'},
  body:JSON.stringify({workspace_id:workspaceId,user_id:userId,role:'owner'}),cache:'no-store'
 });
 if(!memberResponse.ok){
  const memberError=await responseJson(memberResponse);
  console.error('[ReasonLens signup] membership_insert_failed',JSON.stringify({status:memberResponse.status,code:safeErrorCode(memberError)}));
  const cleanup=new URLSearchParams({id:'eq.'+workspaceId});
  await fetch(url+'/rest/v1/reasonlens_workspaces?'+cleanup.toString(),{method:'DELETE',headers,cache:'no-store'}).catch(()=>undefined);
  return null;
 }
 return workspaceId;
}

async function responseJsonArray(response:Response):Promise<Array<Record<string,unknown>> & {errorCode?:string}>{
 try{
  const value=await response.json();
  if(!response.ok){
   const error=value&&typeof value==='object'?value as Record<string,unknown>:{};
   const code=safeErrorCode(error);
   const empty=[] as Array<Record<string,unknown>> & {errorCode?:string};
   empty.errorCode=code;
   return empty;
  }
  return (Array.isArray(value)?value.filter((item:unknown)=>!!item&&typeof item==='object'):[]) as Array<Record<string,unknown>> & {errorCode?:string};
 }catch{return [] as Array<Record<string,unknown>> & {errorCode?:string};}
}

export async function firstActiveWorkspaceForUser(userId:string):Promise<string|null>{
 const {url,serviceKey}=config();
 const headers=serviceHeaders(serviceKey);
 const params=new URLSearchParams({select:'workspace_id,created_at',user_id:'eq.'+userId,order:'created_at.asc',limit:'50'});
 const response=await fetch(url+'/rest/v1/reasonlens_workspace_members?'+params.toString(),{headers,cache:'no-store'});
 if(!response.ok)throw new Error('Workspace membership lookup failed.');
 const memberships=await responseJsonArray(response);
 for(const membership of memberships){
  if(typeof membership.workspace_id!=='string')continue;
  const workspaceQuery=new URLSearchParams({select:'id,status',id:'eq.'+membership.workspace_id,limit:'1'});
  const workspaceResponse=await fetch(url+'/rest/v1/reasonlens_workspaces?'+workspaceQuery.toString(),{headers,cache:'no-store'});
  if(!workspaceResponse.ok)throw new Error('Workspace lookup failed.');
  const workspaces=await responseJsonArray(workspaceResponse);
  if(workspaces[0]?.id===membership.workspace_id&&workspaces[0]?.status==='active')return membership.workspace_id;
 }
 return null;
}
