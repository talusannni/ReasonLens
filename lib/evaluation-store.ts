import type {EvaluationRun} from './evaluation';

function config(){
 const url=process.env.SUPABASE_URL; const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new Error('Supabase persistence is not configured.');
 return {url:url.replace(/\/$/,''),key};
}
function headers(key:string){return {'Content-Type':'application/json','apikey':key,'Authorization':`Bearer ${key}`};}
export async function saveEvaluationRun(run:EvaluationRun):Promise<EvaluationRun>{
 const {url,key}=config();
 const row={id:run.id,created_at:run.createdAt,name:run.name,dataset:run.dataset,results:run.results,summary:{
  totalCases:run.totalCases,evaluatedCases:run.evaluatedCases,missingCases:run.missingCases,passedCases:run.passedCases,
  warnedCases:run.warnedCases,failedCases:run.failedCases,passRate:run.passRate,averageProvenanceScore:run.averageProvenanceScore,
  totalLatencyMs:run.totalLatencyMs,averageLatencyMs:run.averageLatencyMs,totalCostUsd:run.totalCostUsd
 }};
 const res=await fetch(url+'/rest/v1/reasonlens_evaluation_runs',{method:'POST',headers:{...headers(key),Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(row),cache:'no-store'});
 if(!res.ok)throw new Error('Supabase evaluation write failed: '+res.status+' '+await res.text());
 return run;
}
export async function listEvaluationRuns():Promise<EvaluationRun[]>{
 const {url,key}=config();
 const res=await fetch(url+'/rest/v1/reasonlens_evaluation_runs?select=*&order=created_at.desc&limit=50',{headers:headers(key),cache:'no-store'});
 if(!res.ok)throw new Error('Supabase evaluation list failed: '+res.status+' '+await res.text());
 const rows=await res.json();
 return rows.map((row:any)=>({id:row.id,name:row.name,createdAt:row.created_at,dataset:row.dataset,...row.summary,results:row.results}));
}
export async function getEvaluationRun(id:string):Promise<EvaluationRun|undefined>{
 const {url,key}=config();
 const res=await fetch(url+'/rest/v1/reasonlens_evaluation_runs?select=*&id=eq.'+encodeURIComponent(id)+'&limit=1',{headers:headers(key),cache:'no-store'});
 if(!res.ok)throw new Error('Supabase evaluation read failed: '+res.status+' '+await res.text());
 const rows=await res.json(); if(!rows[0])return undefined;
 const row=rows[0]; return {id:row.id,name:row.name,createdAt:row.created_at,dataset:row.dataset,...row.summary,results:row.results};
}
