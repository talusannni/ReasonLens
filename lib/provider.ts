import { buildScenarioTrace } from './scenarios';
import type { Trace, TraceMode } from './types';
export async function runTrace(prompt:string, provider=process.env.REASONLENS_PROVIDER||'mock', model=process.env.REASONLENS_MODEL||'gpt-4o-mini', mode:TraceMode='chat'):Promise<Trace>{
 if(provider==='mock') return buildScenarioTrace(prompt,mode);
 const base=(process.env.OPENAI_BASE_URL||'https://api.openai.com/v1').replace(/\/$/,'');
 const key=process.env.OPENAI_API_KEY;
 if(!key) throw new Error('OPENAI_API_KEY is required for the OpenAI-compatible provider.');
 const started=Date.now();
 const system='You are an AI observability trace generator. Never reveal private chain-of-thought. Return JSON only with keys answer,nodes,edges. Represent concise externally explainable steps, retrieved evidence, tool calls, claims and decisions. nodes:{id,kind,label,detail,metadata}; kind:prompt,analysis,retrieval,evidence,claim,decision,tool,model,answer,warning. edges:{id,source,target,kind}; kind:supports,contradicts,depends_on,produces,retrieves,calls,answers.';
 const res=await fetch(base+'/chat/completions',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+key},body:JSON.stringify({model,messages:[{role:'system',content:system},{role:'user',content:prompt}],temperature:0.1,response_format:{type:'json_object'}})});
 if(!res.ok) throw new Error('Provider returned '+res.status+': '+await res.text());
 const data=await res.json(); const content=data.choices?.[0]?.message?.content; if(!content) throw new Error('Provider returned no content.');
 const parsed=JSON.parse(content); const promptNode={id:'prompt',kind:'prompt' as const,label:'User prompt',detail:prompt}; const answerNode={id:'answer',kind:'answer' as const,label:'Final answer',detail:String(parsed.answer||'')};
 const nodes=(Array.isArray(parsed.nodes)?parsed.nodes:[]).filter((n:any)=>n?.id&&n?.kind&&n?.label&&n.id!=='prompt'&&n.id!=='answer').concat([promptNode,answerNode]);
 const edges=(Array.isArray(parsed.edges)?parsed.edges:[]).filter((e:any)=>e?.source&&e?.target&&e?.kind);
 if(!edges.some((e:any)=>e.target==='answer')) edges.push({id:'final',source:nodes.find((n:any)=>n.id!=='answer')?.id||'prompt',target:'answer',kind:'answers'});
 return {id:crypto.randomUUID(),createdAt:new Date().toISOString(),provider,model,prompt,mode,nodes,edges,answer:answerNode.detail||'',status:'completed',metrics:{latencyMs:Date.now()-started,inputTokens:data.usage?.prompt_tokens||0,outputTokens:data.usage?.completion_tokens||0,estimatedCostUsd:0}};
}
