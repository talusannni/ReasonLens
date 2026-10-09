import type { Trace } from './types';

function config(){
 const url=process.env.SUPABASE_URL;
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key)throw new Error('Supabase persistence is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
 return {url:url.replace(/\/$/,''),key};
}

function headers(key:string){return {'Content-Type':'application/json','apikey':key,'Authorization':`Bearer ${key}`};}

export interface TraceListOptions {
 page:number;
 pageSize:number;
 search?:string;
 mode?:string;
 status?:string;
 provider?:string;
 model?:string;
 since?:string;
 sort?:string;
 execution?:string;
}

export interface TraceListPage {
 traces:Trace[];
 total:number;
 page:number;
 pageSize:number;
 totalPages:number;
}

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

export async function listTracePage(options:TraceListOptions):Promise<TraceListPage>{
 const {url,key}=config();
 const page=Math.max(1,Math.floor(options.page)||1);
 const pageSize=Math.min(100,Math.max(1,Math.floor(options.pageSize)||25));
 const params=new URLSearchParams({select:'*',order:'created_at.desc'});
 const eq=(field:string,value:string|undefined)=>{if(value&&value!=='all')params.set(field,'eq.'+value);};
 eq('mode',options.mode);eq('status',options.status);eq('provider',options.provider);eq('model',options.model);
 if(options.since)params.set('created_at','gte.'+options.since);
 const q=(options.search||'').trim().slice(0,120).replace(/[(),]/g,' ').replace(/\s+/g,' ');
 if(q){
  const pattern='*'+q.replace(/[.*]/g,'')+'*';
  const clauses=[`prompt.ilike.${pattern}`,`provider.ilike.${pattern}`,`model.ilike.${pattern}`];
  if(/^[0-9a-f-]{36}$/i.test(q))clauses.push('id.eq.'+q);
  params.set('or','('+clauses.join(',')+')');
 }
 const sorts:Record<string,string>={'newest':'created_at.desc','oldest':'created_at.asc','latency-desc':'metrics->>latencyMs.desc','latency-asc':'metrics->>latencyMs.asc','cost-desc':'metrics->>estimatedCostUsd.desc','cost-asc':'metrics->>estimatedCostUsd.asc'};
 params.set('order',sorts[options.sort||'newest']||sorts.newest);
 if(options.execution==='retrieval-only')params.set('nodes','cs.[{"metadata":{"replayMode":"retrieval-only"}}]');
 else if(options.execution==='full-pipeline'){
  params.append('nodes','cs.[{"kind":"model"}]');
  params.append('nodes','cs.[{"kind":"retrieval"}]');
 }else if(options.execution==='llm-executed')params.set('nodes','cs.[{"kind":"model"}]');
 else if(options.execution==='no-llm')params.set('nodes','not.cs.[{"kind":"model"}]');
 else if(options.execution==='partial')params.set('status','in.(failed,running)');
 const from=(page-1)*pageSize;
 const to=from+pageSize-1;
 const res=await fetch(url+'/rest/v1/reasonlens_traces?'+params.toString(),{
  headers:{...headers(key),'Prefer':'count=exact','Range-Unit':'items','Range':`${from}-${to}`},
  cache:'no-store'
 });
 if(!res.ok)throw new Error('Supabase trace list failed: '+res.status+' '+await res.text());
 const range=res.headers.get('content-range');
 const total=range&&range.includes('/')&&range.split('/')[1]!=='*'?Number(range.split('/')[1]):0;
 const rows=await res.json();
 const traces:Trace[]=rows.map(toTrace);
 // The execution filter is applied in PostgREST when possible. This defensive pass
 // keeps the partial state/status filter consistent if a backend ignores a JSON filter.
 const totalPages=Math.max(1,Math.ceil(total/pageSize));
 return {traces,total,page,pageSize,totalPages};
}

export async function listTraces():Promise<Trace[]>{
 const result=await listTracePage({page:1,pageSize:100});
 return result.traces;
}

function toTrace(row:any):Trace{
 return {id:row.id,createdAt:row.created_at,provider:row.provider,model:row.model,prompt:row.prompt,mode:row.mode,answer:row.answer,status:row.status,metrics:row.metrics,nodes:row.nodes,edges:row.edges};
}
