const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!serviceKey){console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');process.exit(2);}
function arg(name){const i=process.argv.indexOf('--'+name);return i>=0?process.argv[i+1]:undefined;}
const keyId=arg('key-id');
if(!keyId||!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(keyId)){
 console.error('Usage: node scripts/revoke-workspace-api-key.mjs --key-id <key UUID>');process.exit(2);
}
const headers={apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json',Prefer:'return=representation'};
async function main(){
 const params=new URLSearchParams({select:'id,name,workspace_id,revoked_at',id:'eq.'+keyId,revoked_at:'is.null'});
 const response=await fetch(url+'/rest/v1/reasonlens_api_keys?'+params,{method:'PATCH',headers,body:JSON.stringify({revoked_at:new Date().toISOString()}),cache:'no-store'});
 if(!response.ok)throw new Error('API key revocation failed: '+response.status+' '+(await response.text()).slice(0,200));
 const rows=await response.json();
 if(!rows.length)throw new Error('Active API key not found (it may already be revoked).');
 console.log('Revoked API key: '+rows[0].id+' ('+rows[0].name+')');
 console.log('New authentication attempts with this key will be rejected.');
}
main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exitCode=1;});
