import {createHash,timingSafeEqual} from 'node:crypto';

export const DEFAULT_WORKSPACE_ID='00000000-0000-4000-8000-000000000001';

function config(){
 const url=process.env.SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new Error('Workspace authentication is not configured.');
 return {url:url.replace(/\/$/,''),key};
}
function digest(value:string){return createHash('sha256').update(value).digest('hex');}
function safeEquals(a:string,b:string){
 const left=Buffer.from(a);const right=Buffer.from(b);
 return left.length===right.length&&timingSafeEqual(left,right);
}
function headers(key:string){return {'Content-Type':'application/json','apikey':key,'Authorization':`Bearer ${key}`};}

export async function resolveWorkspaceForCredential(credential:string|undefined):Promise<string|null>{
 if(!credential)return null;
 if(process.env.REASONLENS_INGEST_KEY&&safeEquals(credential,process.env.REASONLENS_INGEST_KEY))return DEFAULT_WORKSPACE_ID;
 try{
  const {url,key}=config();
  const params=new URLSearchParams({select:'workspace_id',key_hash:'eq.'+digest(credential),revoked_at:'is.null',limit:'1'});
  const response=await fetch(url+'/rest/v1/reasonlens_api_keys?'+params.toString(),{headers:headers(key),cache:'no-store'});
  if(!response.ok)return null;
  const rows=await response.json();
  if(!rows[0]||typeof rows[0].workspace_id!=='string')return null;
  const workspaceId=rows[0].workspace_id as string;
  const workspaceParams=new URLSearchParams({select:'id,status',id:'eq.'+workspaceId,limit:'1'});
  const workspaceResponse=await fetch(url+'/rest/v1/reasonlens_workspaces?'+workspaceParams.toString(),{headers:headers(key),cache:'no-store'});
  if(!workspaceResponse.ok)return null;
  const workspaces=await workspaceResponse.json();
  if(!workspaces[0]||workspaces[0].status!=='active')return null;
  void fetch(url+'/rest/v1/reasonlens_api_keys?'+new URLSearchParams({key_hash:'eq.'+digest(credential),revoked_at:'is.null'}).toString(),{
   method:'PATCH',headers:{...headers(key),Prefer:'return=minimal'},body:JSON.stringify({last_used_at:new Date().toISOString()}),cache:'no-store'
  }).catch(()=>undefined);
  return workspaceId;
 }catch{return null;}
}
