import type { Trace, GraphNode, GraphEdge, TraceMode } from './types';

const node=(id:string,kind:GraphNode['kind'],label:string,detail:string,metadata?:Record<string,string|number|boolean>):GraphNode=>({id,kind,label,detail,metadata});
const edge=(id:string,source:string,target:string,kind:GraphEdge['kind']):GraphEdge=>({id,source,target,kind});

export function buildScenarioTrace(prompt:string,mode:TraceMode='chat'):Trace{
 const common=[
  node('prompt','prompt','User prompt',prompt),
  node('intent','analysis','Intent & constraints','Identify the requested outcome and the constraints that materially affect the answer.',{stage:'analysis'}),
 ];
 let nodes:GraphNode[]=[...common], edges:GraphEdge[]=[edge('e1','prompt','intent','produces')], answer='';
 if(mode==='rag'){
  nodes.push(
   node('q','retrieval','Search query','multi-tenant SaaS PostgreSQL MongoDB transactions isolation',{stage:'retrieval'}),
   node('doc1','evidence','PostgreSQL documentation','Transactions provide atomic commit/rollback semantics; relational constraints enforce data integrity.',{source:'demo://postgresql'}),
   node('doc2','evidence','Multi-tenant design note','Row-level security and relational constraints are useful primitives for tenant isolation.',{source:'demo://architecture'}),
   node('claim1','claim','Integrity is a first-class requirement','The retrieved evidence supports a relational design when consistency and constraints dominate.',{confidence:0.92}),
   node('decision','decision','Recommend PostgreSQL','The evidence aligns PostgreSQL with the stated multi-tenant transactional requirements.',{confidence:0.9}),
   node('answer','answer','Final answer','PostgreSQL is the stronger default for this scenario. MongoDB remains reasonable when flexible document modeling is the dominant requirement.')
  );
  edges.push(edge('e2','intent','q','produces'),edge('e3','q','doc1','retrieves'),edge('e4','q','doc2','retrieves'),edge('e5','doc1','claim1','supports'),edge('e6','doc2','claim1','supports'),edge('e7','claim1','decision','supports'),edge('e8','decision','answer','answers'));
  answer='PostgreSQL is the stronger default for this scenario. MongoDB remains reasonable when flexible document modeling is the dominant requirement.';
 } else if(mode==='agent'){
  nodes.push(
   node('plan','analysis','Execution plan','Break the task into research, comparison and recommendation steps.'),
   node('search','tool','Web search','Search product documentation and architecture references.',{tool:'search',durationMs:420}),
   node('calc','tool','Comparison tool','Normalize the requirements against database capabilities.',{tool:'comparison',durationMs:85}),
   node('finding','claim','Requirements favor relational integrity','The observed requirements prioritize transactions, constraints and predictable joins.',{confidence:0.91}),
   node('decision','decision','Select PostgreSQL','Choose the option with the strongest fit to the observed requirements.'),
   node('answer','answer','Final answer','Use PostgreSQL as the default. Choose MongoDB instead when document flexibility and schema variability outweigh relational guarantees.')
  );
  edges.push(edge('e2','intent','plan','produces'),edge('e3','plan','search','calls'),edge('e4','search','calc','produces'),edge('e5','calc','finding','produces'),edge('e6','finding','decision','supports'),edge('e7','decision','answer','answers'));
  answer='Use PostgreSQL as the default. Choose MongoDB instead when document flexibility and schema variability outweigh relational guarantees.';
 } else {
  nodes.push(
   node('model','model','Model response','Generated a structured, externally explainable decision trace.',{model:'reasonlens-demo'}),
   node('claim','claim','PostgreSQL fits the stated constraints','The observed constraints favor transactions, relational integrity and tenant isolation.',{confidence:0.9}),
   node('decision','decision','Recommend PostgreSQL','Decision follows from the explicit constraints and structured claim.'),
   node('answer','answer','Final answer','PostgreSQL is the stronger default for this scenario; MongoDB remains viable when document flexibility is the dominant requirement.')
  );
  edges.push(edge('e2','intent','model','depends_on'),edge('e3','model','claim','produces'),edge('e4','claim','decision','supports'),edge('e5','decision','answer','answers'));
  answer='PostgreSQL is the stronger default for this scenario; MongoDB remains viable when document flexibility is the dominant requirement.';
 }
 return {id:crypto.randomUUID(),createdAt:new Date().toISOString(),provider:'mock',model:'reasonlens-demo',prompt,mode,nodes,edges,answer,metrics:{latencyMs:mode==='agent'?505:mode==='rag'?612:42,inputTokens:Math.max(12,Math.ceil(prompt.length/4)),outputTokens:mode==='agent'?118:mode==='rag'?142:54,estimatedCostUsd:0},status:'completed'};
}
