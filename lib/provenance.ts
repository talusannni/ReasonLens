import type {GraphNode,Trace} from './types';

export interface ClaimProvenance {
  claimId:string; claim:string; confidence:number|null; evidence:string[];
  contradictions:string[]; supported:boolean;
  status:'supported'|'weak'|'unsupported'|'contradicted';
}
export interface ProvenanceReport {
  score:number; claims:ClaimProvenance[]; supportedClaims:number;
  unsupportedClaims:number; contradictedClaims:number; evidenceCount:number;
  decisionCount:number; answerHasProvenance:boolean;
}
const nodeMap=(trace:Trace)=>new Map(trace.nodes.map(n=>[n.id,n]));
function upstreamEvidence(trace:Trace,claimId:string):GraphNode[]{
 const nodes=nodeMap(trace), result:GraphNode[]=[]; const seen=new Set<string>(); const queue=[claimId];
 while(queue.length){const current=queue.shift()!;for(const edge of trace.edges){
  if(edge.target!==current||seen.has(edge.source))continue; seen.add(edge.source);
  const source=nodes.get(edge.source); if(!source)continue;
  if(source.kind==='evidence')result.push(source);
  else if(['claim','retrieval','analysis','decision'].includes(source.kind))queue.push(source.id);
 }}
 return result;
}
function incomingContradictions(trace:Trace,claimId:string):GraphNode[]{
 const nodes=nodeMap(trace);
 return trace.edges.filter(e=>e.target===claimId&&e.kind==='contradicts')
  .map(e=>nodes.get(e.source)).filter(Boolean) as GraphNode[];
}
export function analyzeProvenance(trace:Trace):ProvenanceReport{
 const claims=trace.nodes.filter(n=>n.kind==='claim'), evidence=trace.nodes.filter(n=>n.kind==='evidence');
 const decisions=trace.nodes.filter(n=>n.kind==='decision'), answer=trace.nodes.find(n=>n.kind==='answer');
 const claimReports=claims.map(claim=>{
  const supporting=upstreamEvidence(trace,claim.id), contradictions=incomingContradictions(trace,claim.id);
  const confidence=typeof claim.metadata?.confidence==='number'?Number(claim.metadata.confidence):null;
  let status:ClaimProvenance['status']='unsupported';
  if(contradictions.length)status='contradicted';
  else if(supporting.length&&confidence!==null&&confidence<0.7)status='weak';
  else if(supporting.length)status='supported';
  return {claimId:claim.id,claim:claim.detail||claim.label,confidence,
    evidence:supporting.map(n=>n.id),contradictions:contradictions.map(n=>n.id),
    supported:supporting.length>0,status};
 });
 const supported=claimReports.filter(c=>c.status==='supported'||c.status==='weak').length;
 const contradicted=claimReports.filter(c=>c.status==='contradicted').length;
 const unsupported=claimReports.filter(c=>c.status==='unsupported').length;
 let answerHasProvenance=false;
 if(answer){const reverse=new Set<string>([answer.id]);let changed=true;
  while(changed){changed=false;for(const edge of trace.edges)if(reverse.has(edge.target)&&!reverse.has(edge.source)){reverse.add(edge.source);changed=true;}}
  answerHasProvenance=claimReports.some(c=>reverse.has(c.claimId)&&c.evidence.length>0);
 }
 const denominator=Math.max(claimReports.length,1);
 const score=Math.max(0,Math.min(100,Math.round((supported/denominator)*100-(contradicted/denominator)*35-(unsupported/denominator)*45+(answerHasProvenance?5:0))));
 return {score,claims:claimReports,supportedClaims:supported,unsupportedClaims:unsupported,
  contradictedClaims:contradicted,evidenceCount:evidence.length,decisionCount:decisions.length,answerHasProvenance};
}
