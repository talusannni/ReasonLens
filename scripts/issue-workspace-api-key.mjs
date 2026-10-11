import {createHash,randomBytes} from 'node:crypto';

const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!serviceKey){console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');process.exit(2);}
function arg(name){const i=process.argv.indexOf('--'+name);return i>=0?process.argv[i+1]:undefined;}
const slug=arg('slug');const name=arg('name')||'API key';
if(!slug||!/^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/.test(slug)||!name.trim()||name.length>100){
 console.error('Usage: node scripts/issue-workspace-api-key.mjs --slug acme-team --name "Production SDK"');process.exit(2);
}
const headers={apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json',Prefer:'return=representation'};
async function main(){
 const lookup=new URLSearchParams({select:'id,status',slug:'eq.'+slug,limit:'1'});
 const found=await fetch(url+'/rest/v1/reasonlens_workspaces?'+lookup,{headers,cache:'no-store'});
 if(!found.ok)throw new Error('Workspace lookup failed: '+found.status);
 const rows=await found.json();const workspace=rows[0];
 if(!workspace||workspace.status!=='active')throw new Error('Active workspace not found.');
 const apiKey='rls_live_'+randomBytes(32).toString('base64url');
 const keyHash=createHash('sha256').update(apiKey).digest('hex');
 const created=await fetch(url+'/rest/v1/reasonlens_api_keys',{method:'POST',headers,body:JSON.stringify({workspace_id:workspace.id,name:name.trim(),key_hash:keyHash}),cache:'no-store'});
 if(!created.ok)throw new Error('API key creation failed: '+created.status+' '+(await created.text()).slice(0,200));
 console.log('Workspace: '+slug);console.log('API key name: '+name.trim());console.log('API key (shown once):');console.log(apiKey);
 console.log('Verify the new key works before revoking any old key.');
}
main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exitCode=1;});
