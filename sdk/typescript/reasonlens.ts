export type TraceMode = 'chat'|'rag'|'agent';
export type NodeKind='prompt'|'analysis'|'retrieval'|'evidence'|'claim'|'decision'|'tool'|'model'|'answer'|'warning';
export interface TraceNode{ id:string; kind:NodeKind; label:string; detail?:string; metadata?:Record<string,unknown>; }
export interface TraceEdge{ id:string; source:string; target:string; kind:string; }
const GROQ_PRICING:Record<string,{input:number;output:number}>={'openai/gpt-oss-120b':{input:0.15,output:0.60},'openai/gpt-oss-20b':{input:0.075,output:0.30}};
function estimateGroqCost(model:string,inputTokens:number,outputTokens:number){const pricing=GROQ_PRICING[model];if(!pricing)return 0;return (inputTokens/1_000_000)*pricing.input+(outputTokens/1_000_000)*pricing.output;}
export interface Trace{ id:string; createdAt:string; provider:string; model:string; prompt:string; mode:TraceMode; nodes:TraceNode[]; edges:TraceEdge[]; answer:string; status:'completed'|'failed'|'running'; metrics:{latencyMs:number;inputTokens:number;outputTokens:number;estimatedCostUsd:number}; }

export class TraceContext{
 private started=performance.now();
 private nodes:TraceNode[]=[];
 private edges:TraceEdge[]=[];
 private answerText='';
 private provider='external';
 private model='unknown';
 private lastNodeId:string|null=null;

 constructor(private client:ReasonLens,public readonly prompt:string,public readonly mode:TraceMode='chat',public readonly id=crypto.randomUUID(),private createdAt=new Date().toISOString()){
   this.nodes.push({id:'prompt',kind:'prompt',label:'User prompt',detail:prompt,metadata:{mode}});
   this.lastNodeId='prompt';
 }
 node(kind:NodeKind,label:string,detail='',metadata:Record<string,unknown>={}):string{
   const id=crypto.randomUUID();this.nodes.push({id,kind,label,detail,metadata});
   if(this.lastNodeId)this.edge(this.lastNodeId,id,'depends_on');this.lastNodeId=id;return id;
 }
 edge(source:string,target:string,kind='depends_on'):string{
   const existing=this.edges.find(e=>e.source===source&&e.target===target&&e.kind===kind);
   if(existing)return existing.id;
   const id=crypto.randomUUID();this.edges.push({id,source,target,kind});return id;
 }
 llm(model:string,inputTokens=0,outputTokens=0,outputText='',provider='groq',inputText='',options?:{latencyMs?:number;requestId?:string;finishReason?:string;inputMessages?:Array<Record<string,unknown>>;metadata?:Record<string,unknown>}){
   this.model=model;this.provider=provider;
   const metadata:Record<string,unknown>={inputTokens,outputTokens,inputChars:inputText.length,outputChars:outputText.length,...(options?.metadata||{})};
   if(options?.latencyMs!==undefined)metadata.latencyMs=options.latencyMs;
   if(options?.requestId)metadata.requestId=options.requestId;
   if(options?.finishReason)metadata.finishReason=options.finishReason;
   if(options?.inputMessages)metadata.inputMessages=options.inputMessages;
   return this.node('model','LLM · '+model,outputText,metadata);
 }
 retrieval(query:string,documents:Array<{title?:string;id?:string;content?:string;metadata?:Record<string,unknown>}>,options?:{retriever?:string;topK?:number;latencyMs?:number}){
   const metadata:Record<string,unknown>={documentCount:documents.length,retriever:options?.retriever||'unknown',topK:options?.topK??documents.length};
   if(options?.latencyMs!==undefined)metadata.latencyMs=options.latencyMs;
   const id=this.node('retrieval','Retrieval',query,metadata);
   const evidenceIds:string[]=[];
   for(const [index,d] of documents.entries()){
     const did=d.id||d.title||'evidence-'+(index+1);
     this.node('evidence',d.title||d.id||'Evidence',d.content||'',{rank:index+1,...(d.metadata||{})},did);
     this.edge(id,did,'retrieves');evidenceIds.push(did);
   }
   const retrievalNode=this.nodes.find(n=>n.id===id);if(retrievalNode)retrievalNode.metadata={...retrievalNode.metadata,evidenceIds};
   this.lastNodeId=id;return id;
 }
 tool(name:string,input:unknown,output:unknown,success=true,options?:{latencyMs?:number;error?:string}){
   return this.node('tool','Tool · '+name,JSON.stringify(output),{success,input,...(options?.latencyMs!==undefined?{durationMs:options.latencyMs}:{}),...(options?.error?{error:options.error}:{})});
 }
 claim(text:string,supportedBy:string[]=[],confidence?:number){
   const id=this.node('claim','Claim',text,confidence===undefined?{}:{confidence});for(const source of supportedBy)this.edge(source,id,'supports');return id;
 }
 decision(text:string,confidence?:number){return this.node('decision','Decision',text,confidence===undefined?{}:{confidence});}
 answer(text:string){this.answerText=text;return this.node('answer','Final answer',text);}
 finish():Trace{
   const latencyMs=Math.round(performance.now()-this.started);
   const inputTokens=this.nodes.reduce((n,x)=>n+Number(x.metadata?.inputTokens||0),0);
   const outputTokens=this.nodes.reduce((n,x)=>n+Number(x.metadata?.outputTokens||0),0);
   const trace:Trace={id:this.id,createdAt:this.createdAt,provider:this.provider,model:this.model,prompt:this.prompt,mode:this.mode,nodes:this.nodes,edges:this.edges,answer:this.answerText,status:'completed',metrics:{latencyMs,inputTokens,outputTokens,estimatedCostUsd:this.provider==='groq'?estimateGroqCost(this.model,inputTokens,outputTokens):0}};
   this.client.send(trace);return trace;
 }
}

export class ReasonLens{
 constructor(public readonly baseUrl:string,public readonly apiKey?:string,public readonly timeoutMs=10000){}
 trace(prompt:string,mode:TraceMode='chat'){return new TraceContext(this,prompt,mode);}
 async send(trace:Trace){
   const controller=new AbortController();const timer=setTimeout(()=>controller.abort(),this.timeoutMs);
   try{const headers:Record<string,string>={'Content-Type':'application/json'};if(this.apiKey)headers.Authorization=`Bearer ${this.apiKey}`;
    const res=await fetch(this.baseUrl.replace(/\/$/,'')+'/api/traces',{method:'POST',headers,body:JSON.stringify(trace),signal:controller.signal});
    if(!res.ok)throw new Error(`ReasonLens ingestion failed: ${res.status} ${await res.text()}`);
   }finally{clearTimeout(timer);}
 }
}
