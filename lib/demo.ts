import type { Trace } from './types';
export function buildDemoTrace(prompt:string):Trace {
 const nodes:Trace['nodes']=[
  {id:'prompt',kind:'prompt',label:'User prompt',detail:prompt},
  {id:'analysis',kind:'analysis',label:'Task analysis',detail:'Identify the decision, constraints and comparison criteria.'},
  {id:'e1',kind:'evidence',label:'Transactions',detail:'Strong transactional guarantees are relevant to most SaaS workloads.',metadata:{source:'synthetic'}},
  {id:'e2',kind:'evidence',label:'Tenant isolation',detail:'Relational constraints and row-level policies can enforce isolation.',metadata:{source:'synthetic'}},
  {id:'c1',kind:'claim',label:'PostgreSQL fits the constraints',detail:'The evidence supports PostgreSQL for a relational, multi-tenant SaaS.'},
  {id:'d1',kind:'decision',label:'Recommend PostgreSQL',detail:'Selected because the stated requirements prioritize integrity and transactional consistency.'},
  {id:'answer',kind:'answer',label:'Final answer',detail:'PostgreSQL is the stronger default for this scenario; MongoDB remains viable when document flexibility is the dominant requirement.'}
 ];
 const edges:Trace['edges']=[{id:'a',source:'prompt',target:'analysis',kind:'produces'},{id:'b',source:'analysis',target:'e1',kind:'depends_on'},{id:'c',source:'analysis',target:'e2',kind:'depends_on'},{id:'d',source:'e1',target:'c1',kind:'supports'},{id:'e',source:'e2',target:'c1',kind:'supports'},{id:'f',source:'c1',target:'d1',kind:'supports'},{id:'g',source:'d1',target:'answer',kind:'answers'}];
 return {id:crypto.randomUUID(),createdAt:new Date().toISOString(),provider:'mock',model:'reasonlens-demo',prompt,nodes,edges,answer:nodes.find(n=>n.id==='answer')!.detail!,metrics:{latencyMs:42,inputTokens:prompt.length,outputTokens:54,estimatedCostUsd:0}};
}
