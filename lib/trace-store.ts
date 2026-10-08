import type { Trace } from './types';

function config(){
 const url=process.env.SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new Error('Supabase persistence is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
 return {url:url.replace(/\/$/,''),key};
}

function headers(key:string){return {'Content-Type':'application/json','apikey':key,'Authorization':`Bearer ${key}`};}

export async function saveTrace(trace:Trace):Promise<Trace>{
 const {url,key}=config();
 const row={id:trace.id,created_at:trace.createdAt,provider:trace.provider,model:trace.model,prompt:trace.prompt,mode:trace.mode,answer:trace.answer,status:trace.status,metrics:trace.metrics,nodes:trace.nodes,edges:trace.edges};
 const res=await fetch(url+'/rest/v1/reasonlens_traces',{method:'POST',headers:{...headers(key),Prefer:'resolution=merge-duplicates,return=minimal'},body:JSON.stringify(row),cache:'no-store'});
 if(!res.ok)throw new Error('Supabase trace write failed: '+res.status+' '+await res.text());
 return trace;
}

export async function getTrace(id:string):Promise<Trace|undefined>{
 const {url,key}=config();
 const res=await fetch(url+'/rest/v1/reasonlens_traces?select=*&id=eq.'+encodeURIComponent(id)+'&limit=1',{headers:headers(key),cache:'no-store'});
 if(!res.ok)throw new Error('Supabase trace read failed: '+res.status+' '+await res.text());
 const rows=await res.json();
 return rows[0]?toTrace(rows[0]):undefined;
}

export async function listTraces():Promise<Trace[]>{
 const {url,key}=config();
 const res=await fetch(url+'/rest/v1/reasonlens_traces?select=*&order=created_at.desc&limit=100',{headers:headers(key),cache:'no-store'});
 if(!res.ok)throw new Error('Supabase trace list failed: '+res.status+' '+await res.text());
 const rows=await res.json();
 return rows.map(toTrace);
}

function toTrace(row:any):Trace{
 return {id:row.id,createdAt:row.created_at,provider:row.provider,model:row.model,prompt:row.prompt,mode:row.mode,answer:row.answer,status:row.status,metrics:row.metrics,nodes:row.nodes,edges:row.edges};
}
