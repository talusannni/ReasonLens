import {createHash,randomBytes,randomUUID} from 'node:crypto';

const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!serviceKey){
 console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before creating a workspace key.');
 process.exit(2);
}
function arg(name){
 const index=process.argv.indexOf('--'+name);
 return index>=0?process.argv[index+1]:undefined;
}
const slug=arg('slug');
const name=arg('name');
if(!slug||!/^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/.test(slug)||!name?.trim()||name.trim().length>100){
 console.error('Usage: npm run workspace:create-key -- --slug acme-team --name "Acme Team"');
 process.exit(2);
}
const headers={apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json',Prefer:'return=representation'};
async function post(table,row){
 const response=await fetch(url+'/rest/v1/'+table,{method:'POST',headers,body:JSON.stringify(row),cache:'no-store'});
 if(!response.ok)throw new Error(table+' insert failed: '+response.status+' '+(await response.text()).slice(0,300));
 const rows=await response.json();
 return rows[0];
}
async function main(){
 const workspaceId=randomUUID();
 const apiKey='rls_live_'+randomBytes(32).toString('base64url');
 const keyHash=createHash('sha256').update(apiKey).digest('hex');
 await post('reasonlens_workspaces',{id:workspaceId,name:name.trim(),slug,status:'active'});
 try{
  await post('reasonlens_api_keys',{workspace_id:workspaceId,name:'Initial API key',key_hash:keyHash});
 }catch(error){
  await fetch(url+'/rest/v1/reasonlens_workspaces?id=eq.'+workspaceId,{method:'DELETE',headers,cache:'no-store'}).catch(()=>undefined);
  throw error;
 }
 console.log('Workspace created: '+slug);
 console.log('Workspace ID: '+workspaceId);
 console.log('API key (shown once; store it securely):');
 console.log(apiKey);
 console.log('Use it as Authorization: Bearer <key> for /api/traces.');
}
main().catch(error=>{console.error(error instanceof Error?error.message:error);process.exitCode=1;});
