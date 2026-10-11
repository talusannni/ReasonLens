const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!serviceKey){console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');process.exit(2);}
function arg(name){const i=process.argv.indexOf('--'+name);return i>=0?process.argv[i+1]:undefined;}
const slug=arg('workspace');
const daysText=arg('days')||'90';
const days=Number(daysText);
const apply=process.argv.includes('--apply');
if(!slug||!/^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/.test(slug)||!Number.isInteger(days)||days<1||days>3650){
 console.error('Usage: node scripts/retention-maintenance.mjs --workspace acme-team [--days 90] [--apply]');
 console.error('Dry-run is the default. --apply is required to permanently delete data.');
 process.exit(2);
}
const headers={apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json'};
const cutoff=new Date(Date.now()-days*24*60*60*1000).toISOString();
async function countOld(table,workspaceId){
 const params=new URLSearchParams({select:'id',workspace_id:'eq.'+workspaceId,created_at:'lt.'+cutoff,limit:'1'});
 const response=await fetch(url+'/rest/v1/'+table+'?'+params,{headers:{...headers,Prefer:'count=exact',Range:'0-0'},cache:'no-store'});
 if(!response.ok)throw new Error(table+' count failed: '+response.status);
 const range=response.headers.get('content-range');
 if(!range||!range.includes('/'))throw new Error(table+' count did not return an exact count.');
 const total=range.split('/')[1];
 if(total==='*'||!Number.isFinite(Number(total)))throw new Error(table+' count was not exact.');
 return Number(total);
}
async function deleteOld(table,workspaceId){
 const params=new URLSearchParams({workspace_id:'eq.'+workspaceId,created_at:'lt.'+cutoff});
 const response=await fetch(url+'/rest/v1/'+table+'?'+params,{method:'DELETE',headers:{...headers,Prefer:'return=minimal'},cache:'no-store'});
 if(!response.ok)throw new Error(table+' deletion failed: '+response.status+' '+(await response.text()).slice(0,200));
}
async function main(){
 const params=new URLSearchParams({select:'id,name,status',slug:'eq.'+slug,limit:'1'});
 const found=await fetch(url+'/rest/v1/reasonlens_workspaces?'+params,{headers,cache:'no-store'});
 if(!found.ok)throw new Error('Workspace lookup failed: '+found.status);
 const rows=await found.json();const workspace=rows[0];
 if(!workspace)throw new Error('Workspace not found.');
 const traceCount=await countOld('reasonlens_traces',workspace.id);
 const evaluationCount=await countOld('reasonlens_evaluation_runs',workspace.id);
 console.log('Workspace: '+workspace.name+' ('+slug+')');
 console.log('Retention cutoff: '+cutoff+' ('+days+' days)');
 console.log('Old traces: '+traceCount);
 console.log('Old evaluation runs: '+evaluationCount);
 if(!apply){console.log('Dry run only. Re-run with --apply to permanently delete these rows.');return;}
 await deleteOld('reasonlens_evaluation_runs',workspace.id);
 await deleteOld('reasonlens_traces',workspace.id);
 console.log('Retention deletion completed.');
}
main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exitCode=1;});
