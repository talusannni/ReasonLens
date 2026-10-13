import type {Trace} from './types';
import {analyzeProvenance,isProvenanceApplicable} from './provenance';
import {compareProvenance} from './provenance-regression';

export type QualityGateStatus='PASS'|'WARN'|'FAIL';
export type QualityGateSeverity='fail'|'warn';

export interface QualityGateConfig{
 minProvenanceScore:number;
 maxProvenanceDrop:number;
 maxContradictedClaims:number;
 maxUnsupportedClaims:number;
 requireAnswerProvenance:boolean;
 maxLatencyMs?:number;
 maxCostUsd?:number;
}

export interface QualityGateRule{
 id:string;
 label:string;
 severity:QualityGateSeverity;
 status:QualityGateStatus;
 actual:string;
 threshold:string;
 message:string;
}

export interface QualityGateReport{
 status:QualityGateStatus;
 passed:number;
 warnings:number;
 failures:number;
 rules:QualityGateRule[];
}

export const DEFAULT_QUALITY_GATES:QualityGateConfig={
 minProvenanceScore:80,
 maxProvenanceDrop:10,
 maxContradictedClaims:0,
 maxUnsupportedClaims:0,
 requireAnswerProvenance:true,
 maxLatencyMs:2000,
 maxCostUsd:0.01
};

function statusForFail(condition:boolean):QualityGateStatus{return condition?'FAIL':'PASS';}
function statusForWarn(condition:boolean):QualityGateStatus{return condition?'WARN':'PASS';}

function summarize(rules:QualityGateRule[]):QualityGateReport{
 const failures=rules.filter(r=>r.status==='FAIL').length;
 const warnings=rules.filter(r=>r.status==='WARN').length;
 return {status:failures?'FAIL':warnings?'WARN':'PASS',passed:rules.length-failures-warnings,warnings,failures,rules};
}

function hasAgentExecutionPath(trace:Trace):boolean{
 const answer=trace.nodes.find(n=>n.kind==='answer');
 if(!answer)return false;
 const nodes=new Map(trace.nodes.map(n=>[n.id,n]));
 const ancestors=new Set<string>([answer.id]);
 const queue=[answer.id];
 while(queue.length){
  const target=queue.shift()!;
  for(const edge of trace.edges){
   if(edge.target!==target||ancestors.has(edge.source))continue;
   ancestors.add(edge.source);queue.push(edge.source);
  }
 }
 return Array.from(ancestors).some(id=>{
  const node=nodes.get(id);
  return !!node&&(node.kind==='tool'||node.kind==='decision');
 });
}

export function evaluateTrace(trace:Trace,config:QualityGateConfig=DEFAULT_QUALITY_GATES):QualityGateReport{
 const p=analyzeProvenance(trace);
 const provenanceApplicable=isProvenanceApplicable(trace);
 const rules:QualityGateRule[]=[
  {id:'answer-present',label:'Final answer',severity:'fail',status:statusForFail(!trace.answer.trim()),actual:trace.answer.trim()?'present':'missing',threshold:'present',message:trace.answer.trim()?'A final answer was recorded.':'No final answer was recorded for this trace.'},
  {id:'trace-completed',label:'Execution status',severity:'fail',status:statusForFail(trace.status!=='completed'),actual:trace.status,threshold:'completed',message:trace.status!=='completed'?'The trace did not complete successfully.':'The trace completed successfully.'},
  {id:'contradictions',label:'Contradicted claims',severity:'fail',status:statusForFail(p.contradictedClaims>config.maxContradictedClaims),actual:String(p.contradictedClaims),threshold:`≤ ${config.maxContradictedClaims}`,message:p.contradictedClaims>config.maxContradictedClaims?`${p.contradictedClaims} contradicted claim(s) exceed the allowed ${config.maxContradictedClaims}.`:'No disallowed contradictions detected.'}
 ];
 if(trace.mode==='agent'){
  const hasPath=hasAgentExecutionPath(trace);
  rules.push({id:'agent-execution-path',label:'Agent execution path',severity:'fail',status:statusForFail(!hasPath),actual:hasPath?'connected':'missing',threshold:'tool or decision connected to final answer',message:hasPath?'The final answer is connected to a recorded tool or decision.':'The final answer is not connected to a recorded tool or decision.'});
  const failedTools=trace.nodes.filter(node=>node.kind==='tool'&&(
   node.metadata?.success===false||
   (typeof node.metadata?.status==='string'&&['failed','error'].includes(node.metadata.status.toLowerCase()))||
   (typeof node.metadata?.error==='string'&&node.metadata.error.trim().length>0)||
   (typeof node.metadata?.errorMessage==='string'&&node.metadata.errorMessage.trim().length>0)
  ));
  rules.push({id:'agent-tool-outcomes',label:'Recorded tool outcomes',severity:'fail',status:statusForFail(failedTools.length>0),actual:`${failedTools.length} failed tool(s)`,threshold:'0 failed tools',message:failedTools.length? `${failedTools.length} tool call(s) recorded an explicit failure.`:'No explicit tool failures were recorded.'});
 }
 if(provenanceApplicable){
  rules.push(
   {id:'provenance-score',label:'Minimum provenance score',severity:'fail',status:statusForFail(p.score<config.minProvenanceScore),actual:`${p.score}/100`,threshold:`≥ ${config.minProvenanceScore}`,message:p.score<config.minProvenanceScore?`Provenance score ${p.score} is below the required ${config.minProvenanceScore}.`:'Provenance score meets the minimum.'},
   {id:'answer-provenance',label:'Answer provenance path',severity:'fail',status:statusForFail(config.requireAnswerProvenance&&!p.answerHasProvenance),actual:p.answerHasProvenance?'present':'missing',threshold:config.requireAnswerProvenance?'present':'not required',message:config.requireAnswerProvenance&&!p.answerHasProvenance?'The final answer is not connected to evidence-backed claims.':'Answer provenance requirement is satisfied.'},
   {id:'unsupported-claims',label:'Unsupported claims',severity:'warn',status:statusForWarn(p.unsupportedClaims>config.maxUnsupportedClaims),actual:String(p.unsupportedClaims),threshold:`≤ ${config.maxUnsupportedClaims}`,message:p.unsupportedClaims>config.maxUnsupportedClaims?`${p.unsupportedClaims} unsupported claim(s) exceed the warning threshold.`:'Unsupported-claim threshold is satisfied.'}
  );
 }
 if(config.maxLatencyMs!==undefined)rules.push({id:'latency',label:'Latency',severity:'warn',status:statusForWarn(trace.metrics.latencyMs>config.maxLatencyMs),actual:`${trace.metrics.latencyMs} ms`,threshold:`≤ ${config.maxLatencyMs} ms`,message:trace.metrics.latencyMs>config.maxLatencyMs?`Latency ${trace.metrics.latencyMs} ms exceeds the ${config.maxLatencyMs} ms warning threshold.`:'Latency is within the configured threshold.'});
 if(config.maxCostUsd!==undefined)rules.push({id:'cost',label:'Estimated cost',severity:'warn',status:statusForWarn(trace.metrics.estimatedCostUsd>config.maxCostUsd),actual:`$${trace.metrics.estimatedCostUsd.toFixed(6)}`,threshold:`≤ $${config.maxCostUsd}`,message:trace.metrics.estimatedCostUsd>config.maxCostUsd?`Estimated cost exceeds the $${config.maxCostUsd} warning threshold.`:'Estimated cost is within the configured threshold.'});
 return summarize(rules);
}

export function evaluateComparison(a:Trace,b:Trace,config:QualityGateConfig=DEFAULT_QUALITY_GATES):QualityGateReport{
 const base=evaluateTrace(b,config);
 const rules=[...base.rules];
 if(a.mode===b.mode&&isProvenanceApplicable(a)&&isProvenanceApplicable(b)){
  const diff=compareProvenance(a,b);
  rules.push({
   id:'provenance-drop',label:'Maximum provenance score drop',severity:'warn',
   status:statusForWarn(diff.scoreDelta< -config.maxProvenanceDrop),
   actual:`${diff.scoreDelta>=0?'+':''}${diff.scoreDelta}`,
   threshold:`≥ -${config.maxProvenanceDrop}`,
   message:diff.scoreDelta< -config.maxProvenanceDrop?`Provenance score dropped by ${Math.abs(diff.scoreDelta)} points from Run A to Run B.`:'Provenance score did not exceed the configured regression limit.'
  });
 }
 return summarize(rules);
}
