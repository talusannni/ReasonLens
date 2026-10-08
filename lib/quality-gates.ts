import type {Trace} from './types';
import {analyzeProvenance} from './provenance';
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

export function evaluateTrace(trace:Trace,config:QualityGateConfig=DEFAULT_QUALITY_GATES):QualityGateReport{
 const p=analyzeProvenance(trace);
 const rules:QualityGateRule[]=[
  {id:'provenance-score',label:'Minimum provenance score',severity:'fail',status:statusForFail(p.score<config.minProvenanceScore),actual:`${p.score}/100`,threshold:`≥ ${config.minProvenanceScore}`,message:p.score<config.minProvenanceScore?`Provenance score ${p.score} is below the required ${config.minProvenanceScore}.`:'Provenance score meets the minimum.'},
  {id:'contradictions',label:'Contradicted claims',severity:'fail',status:statusForFail(p.contradictedClaims>config.maxContradictedClaims),actual:String(p.contradictedClaims),threshold:`≤ ${config.maxContradictedClaims}`,message:p.contradictedClaims>config.maxContradictedClaims?`${p.contradictedClaims} contradicted claim(s) exceed the allowed ${config.maxContradictedClaims}.`:'No disallowed contradictions detected.'},
  {id:'answer-provenance',label:'Answer provenance path',severity:'fail',status:statusForFail(config.requireAnswerProvenance&&!p.answerHasProvenance),actual:p.answerHasProvenance?'present':'missing',threshold:config.requireAnswerProvenance?'present':'not required',message:config.requireAnswerProvenance&&!p.answerHasProvenance?'The final answer is not connected to evidence-backed claims.':'Answer provenance requirement is satisfied.'},
  {id:'unsupported-claims',label:'Unsupported claims',severity:'warn',status:statusForWarn(p.unsupportedClaims>config.maxUnsupportedClaims),actual:String(p.unsupportedClaims),threshold:`≤ ${config.maxUnsupportedClaims}`,message:p.unsupportedClaims>config.maxUnsupportedClaims?`${p.unsupportedClaims} unsupported claim(s) exceed the warning threshold.`:'Unsupported-claim threshold is satisfied.'}
 ];
 if(config.maxLatencyMs!==undefined)rules.push({id:'latency',label:'Latency',severity:'warn',status:statusForWarn(trace.metrics.latencyMs>config.maxLatencyMs),actual:`${trace.metrics.latencyMs} ms`,threshold:`≤ ${config.maxLatencyMs} ms`,message:trace.metrics.latencyMs>config.maxLatencyMs?`Latency ${trace.metrics.latencyMs} ms exceeds the ${config.maxLatencyMs} ms warning threshold.`:'Latency is within the configured threshold.'});
 if(config.maxCostUsd!==undefined)rules.push({id:'cost',label:'Estimated cost',severity:'warn',status:statusForWarn(trace.metrics.estimatedCostUsd>config.maxCostUsd),actual:`$${trace.metrics.estimatedCostUsd.toFixed(6)}`,threshold:`≤ $${config.maxCostUsd}`,message:trace.metrics.estimatedCostUsd>config.maxCostUsd?`Estimated cost exceeds the $${config.maxCostUsd} warning threshold.`:'Estimated cost is within the configured threshold.'});
 return summarize(rules);
}

export function evaluateComparison(a:Trace,b:Trace,config:QualityGateConfig=DEFAULT_QUALITY_GATES):QualityGateReport{
 const base=evaluateTrace(b,config);
 const diff=compareProvenance(a,b);
 const rules=[...base.rules,{
  id:'provenance-drop',label:'Maximum provenance score drop',severity:'warn' as const,
  status:statusForWarn(diff.scoreDelta< -config.maxProvenanceDrop),
  actual:`${diff.scoreDelta>=0?'+':''}${diff.scoreDelta}`,
  threshold:`≥ -${config.maxProvenanceDrop}`,
  message:diff.scoreDelta< -config.maxProvenanceDrop?`Provenance score dropped by ${Math.abs(diff.scoreDelta)} points from Run A to Run B.`:'Provenance score did not exceed the configured regression limit.'
}];
 return summarize(rules);
}
