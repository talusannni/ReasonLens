const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
if(!url||!serviceKey){console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');process.exit(2);}
function arg(name){const i=process.argv.indexOf('--'+name);return i>=0?process.argv[i+1]:undefined;}
const slug=arg('workspace');
const apply=process.argv.includes('--apply');
if(!slug||!/^[a-z0-9](?:[a-z0-9-]{1,48}[a-z0-9])$/.test(slug)){
 console.error('Usage: node scripts/delete-workspace.mjs --workspace acme-team [--apply]');
 console.error('Dry-run is the default. The default workspace cannot be deleted.');
 process.exit(2);
}
const headers={apikey:serviceKey,Authorization:'Bearer '+serviceKey,'Content-Type':'application/json',Prefer:'return=minimal'};
async function countRows(table,workspaceId){
 const params=new URLSearchParams({select:'*',workspace_id:'eq.'+workspaceId,limit:'1'});
 const response=await fetch(url+'/rest/v1/'+table+'?'+params,{headers:{...headers,Prefer:'count=exact',Range:'0-0'},cache:'no-store'});
 if(!response.ok)throw new Error(table+' count failed: '+response.status);
 const range=response.headers.get('content-range');
 if(!range||!range.includes('/'))throw new Error(table+' count did not return an exact count.');
 const total=range.split('/')[1];
 if(total==='*'||!Number.isFinite(Number(total)))throw new Error(table+' count was not exact.');
 return Number(total);
}
async function deleteWorkspaceRows(table,workspaceId){
 const params=new URLSearchParams({workspace_id:'eq.'+workspaceId});
 const response=await fetch(url+'/rest/v1/'+table+'?'+params,{method:'DELETE',headers,cache:'no-store'});
 if(!response.ok)throw new Error(table+' deletion failed: '+response.status+' '+(await response.text()).slice(0,200));
}
async function main(){
 const lookup=new URLSearchParams({select:'id,name,slug',slug:'eq.'+slug,limit:'1'});
 const found=await fetch(url+'/rest/v1/reasonlens_workspaces?'+lookup,{headers,cache:'no-store'});
 if(!found.ok)throw new Error('Workspace lookup failed: '+found.status);
 const rows=await found.json();const workspace=rows[0];
 if(!workspace)throw new Error('Workspace not found.');
 if(workspace.slug==='default'||workspace.id==='00000000-0000-4000-8000-000000000001')throw new Error('Refusing to delete the default workspace.');
 const tables=['reasonlens_traces','reasonlens_evaluation_runs','reasonlens_api_keys','reasonlens_workspace_members','reasonlens_workspace_invitations'];
 const counts={};
 for(const table of tables){
  try{counts[table]=await countRows(table,workspace.id);}
  catch(error){
   // Missing optional team tables mean the workspace foundation migration is not fully applied.
   if(table==='reasonlens_workspace_members'||table==='reasonlens_workspace_invitations')throw error;
   throw error;
  }
 }
 console.log('Workspace: '+workspace.name+' ('+slug+')');
 for(const [table,count] of Object.entries(counts))console.log(table+': '+count);
 console.log('Rate-limit windows will be removed by the workspace foreign-key cascade.');
 if(!apply){console.log('Dry run only. Back up any required data, then re-run with --apply to permanently delete this workspace.');return;}
 for(const table of ['reasonlens_evaluation_runs','reasonlens_traces','reasonlens_api_keys','reasonlens_workspace_members','reasonlens_workspace_invitations']){
  await deleteWorkspaceRows(table,workspace.id);
 }
 const deleteParams=new URLSearchParams({id:'eq.'+workspace.id});
 const deleted=await fetch(url+'/rest/v1/reasonlens_workspaces?'+deleteParams,{method:'DELETE',headers,cache:'no-store'});
 if(!deleted.ok)throw new Error('Workspace deletion failed: '+deleted.status+' '+(await deleted.text()).slice(0,200));
 console.log('Workspace and workspace-owned data deleted. This action cannot be undone from ReasonLens.');
}
main().catch(e=>{console.error(e instanceof Error?e.message:e);process.exitCode=1;});
