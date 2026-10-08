export type TraceMode = 'chat'|'rag'|'agent';
export type NodeKind='prompt'|'analysis'|'retrieval'|'evidence'|'claim'|'decision'|'tool'|'model'|'answer'|'warning';

export interface TraceNode{ id:string; kind:NodeKind; label:string; detail?:string; metadata?:Record<string,unknown>; }
export interface TraceEdge{ id:string; source:string; target:string; kind:string; }
export interface Trace{ id:string; createdAt:string; provider:string; model:string; prompt:string; mode:TraceMode; nodes:TraceNode[]; edges:TraceEdge[]; answer:string; status:'completed'|'failed'|'running'; metrics:{latencyMs:number;inputTokens:number;outputTokens:number;estimatedCostUsd:number}; }

export class TraceContext{
 private started=performance.now();
 private nodes:TraceNode[]=[];
 private edges:TraceEdge[]=[];
 private answerText='';
 private provider='external';
 private model='unknown';
 constructor(private client:ReasonLens,public readonly prompt:string,public readonly mode:TraceMode='chat',public readonly id=crypto.randomUUID(),private createdAt=new Date().toISOString()){}
 node(kind:NodeKind,label:string,detail='',metadata:Record<string,unknown>={}):string{const id=crypto.randomUUID();this.nodes.push({id,kind,label,detail,metadata});return id;}
 edge(source:string,target:string,kind='depends_on'):string{const id=crypto.randomUUID();this.edges.push({id,source,target,kind});return id;}
 llm(model:string,inputTokens=0,outputTokens=0,outputText='',provider='groq'){this.model=model;this.provider=provider;return this.node('model',`LLM · ${model}`,outputText,{inputTokens,outputTokens});}
 retrieval(query:string,documents:Array<{title?:string;id?:string;content?:string;metadata?:Record<string,unknown>}>){const id=this.node('retrieval','Retrieval',query,{documentCount:documents.length});for(const d of documents){const did=this.node('evidence',d.title||d.id||'Evidence',d.content||'',d.metadata||{});this.edge(id,did,'retrieves');}return id;}
 tool(name:string,input:unknown,output:unknown,success=true){return this.node('tool',`Tool · ${name}`,JSON.stringify(output),{success,input:JSON.stringify(input)});}
 claim(text:string,supportedBy:string[]=[]){const id=this.node('claim','Claim',text);for(const source of supportedBy)this.edge(source,id,'supports');return id;}
 decision(text:string){return this.node('decision','Decision',text);}
 answer(text:string){this.answerText=text;return this.node('answer','Final answer',text);}
 finish():Trace{const latencyMs=Math.round(performance.now()-this.started);const inputTokens=this.nodes.reduce((n,x)=>n+Number(x.metadata?.inputTokens||0),0);const outputTokens=this.nodes.reduce((n,x)=>n+Number(x.metadata?.outputTokens||0),0);const trace:Trace={id:this.id,createdAt:this.createdAt,provider:this.provider,model:this.model,prompt:this.prompt,mode:this.mode,nodes:this.nodes,edges:this.edges,answer:this.answerText,status:'completed',metrics:{latencyMs,inputTokens,outputTokens,estimatedCostUsd:0}};this.client.send(trace);return trace;}
}
export class ReasonLens{
 constructor(public readonly baseUrl:string,public readonly apiKey?:string,public readonly timeoutMs=10000){}
 trace(prompt:string,mode:TraceMode='chat'){return new TraceContext(this,prompt,mode);}
 async send(trace:Trace){const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),this.timeoutMs);try{const headers:Record<string,string>={'Content-Type':'application/json'};if(this.apiKey)headers.Authorization=`Bearer ${this.apiKey}`;const res=await fetch(this.baseUrl.replace(/\/$/,'')+'/api/traces',{method:'POST',headers,body:JSON.stringify(trace),signal:controller.signal});if(!res.ok)throw new Error(`ReasonLens ingestion failed: ${res.status} ${await res.text()}`);}finally{clearTimeout(timer);}}
}
