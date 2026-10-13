import type {EvaluationRun,EvaluationCaseResult} from './evaluation';

export type RegressionGateStatus='PASS'|'WARN'|'FAIL';
export interface EvaluationRegressionConfig {
  maxPassRateDrop:number;
  maxProvenanceDrop:number;
  maxLatencyIncreasePercent:number;
  maxCostIncreasePercent:number;
  failOnCaseRegression:boolean;
  failOnMissingCases:boolean;
}
export interface EvaluationRegressionRule {
  id:string; label:string; status:RegressionGateStatus; actual:string; threshold:string; message:string;
}
export interface EvaluationRegressionReport {
  status:RegressionGateStatus; failures:number; warnings:number; rules:EvaluationRegressionRule[];
  caseRegressions:EvaluationCaseResult[]; caseImprovements:EvaluationCaseResult[];
  passRateDelta:number; provenanceDelta:number; latencyIncreasePercent:number; costIncreasePercent:number;
}
export const DEFAULT_EVALUATION_REGRESSION_CONFIG:EvaluationRegressionConfig={
  maxPassRateDrop:0,maxProvenanceDrop:5,maxLatencyIncreasePercent:25,maxCostIncreasePercent:25,
  failOnCaseRegression:true,failOnMissingCases:true
};
const round=(n:number)=>Math.round(n*10)/10;
function pctIncrease(before:number,after:number):number {
  if(before===0)return after>0?100:0;
  return round((after-before)/Math.abs(before)*100);
}
export function evaluateEvaluationRegression(
  baseline:EvaluationRun,current:EvaluationRun,
  config:EvaluationRegressionConfig=DEFAULT_EVALUATION_REGRESSION_CONFIG
):EvaluationRegressionReport {
  const rank=(s:EvaluationCaseResult['status'])=>s==='passed'?3:s==='warned'?2:s==='failed'?1:0;
  const before=new Map(baseline.results.map(r=>[r.caseId,r]));
  const caseRegressions:EvaluationCaseResult[]=[];
  const caseImprovements:EvaluationCaseResult[]=[];
  for(const result of current.results){
    const previous=before.get(result.caseId);
    if(!previous)continue;
    if(rank(result.status)<rank(previous.status))caseRegressions.push(result);
    if(rank(result.status)>rank(previous.status))caseImprovements.push(result);
  }
  const passRateDelta=round(current.passRate-baseline.passRate);
  const provenanceComparable=baseline.provenanceEvaluatedCases>0&&current.provenanceEvaluatedCases>0;
  const provenanceDelta=provenanceComparable?round(current.averageProvenanceScore-baseline.averageProvenanceScore):0;
  const latencyIncreasePercent=pctIncrease(baseline.averageLatencyMs,current.averageLatencyMs);
  const costIncreasePercent=pctIncrease(baseline.totalCostUsd,current.totalCostUsd);
  const missing=current.missingCases;
  const rules:EvaluationRegressionRule[]=[
    {id:'pass-rate',label:'Evaluation pass-rate drop',status:passRateDelta < -config.maxPassRateDrop?'FAIL':'PASS',actual:`${passRateDelta}%`,threshold:`≥ -${config.maxPassRateDrop}%`,message:passRateDelta < -config.maxPassRateDrop?'Evaluation pass rate regressed beyond the allowed threshold.':'Evaluation pass-rate threshold satisfied.'},
    ...(provenanceComparable?[{id:'provenance',label:'Average provenance-score drop',status:provenanceDelta < -config.maxProvenanceDrop?'FAIL' as const:'PASS' as const,actual:String(provenanceDelta),threshold:`≥ -${config.maxProvenanceDrop}`,message:provenanceDelta < -config.maxProvenanceDrop?'Average provenance score regressed beyond the allowed threshold.':'Provenance-score threshold satisfied.'}]:[]),
    {id:'latency',label:'Average latency increase',status:latencyIncreasePercent > config.maxLatencyIncreasePercent?'WARN':'PASS',actual:`${latencyIncreasePercent}%`,threshold:`≤ ${config.maxLatencyIncreasePercent}% increase`,message:latencyIncreasePercent > config.maxLatencyIncreasePercent?'Average latency increased beyond the warning threshold.':'Latency threshold satisfied.'},
    {id:'cost',label:'Total estimated cost increase',status:costIncreasePercent > config.maxCostIncreasePercent?'WARN':'PASS',actual:`${costIncreasePercent}%`,threshold:`≤ ${config.maxCostIncreasePercent}% increase`,message:costIncreasePercent > config.maxCostIncreasePercent?'Estimated evaluation cost increased beyond the warning threshold.':'Cost threshold satisfied.'},
    {id:'case-regressions',label:'Per-case regressions',status:caseRegressions.length&&config.failOnCaseRegression?'FAIL':'PASS',actual:String(caseRegressions.length),threshold:config.failOnCaseRegression?'0':'informational',message:caseRegressions.length&&config.failOnCaseRegression?'One or more evaluation cases regressed.':'No disallowed per-case regressions.'},
    {id:'missing-cases',label:'Missing evaluation cases',status:missing&&config.failOnMissingCases?'FAIL':'PASS',actual:String(missing),threshold:config.failOnMissingCases?'0':'informational',message:missing&&config.failOnMissingCases?'The current run has missing evaluation cases.':'No disallowed missing evaluation cases.'},
    {id:'not-evaluated-cases',label:'Cases not evaluated',status:current.notEvaluatedCases>0?'FAIL':'PASS',actual:String(current.notEvaluatedCases),threshold:'0',message:current.notEvaluatedCases>0?'One or more matched traces could not be evaluated because no answer was generated.':'All matched traces were eligible for evaluation.'}
  ];
  const failures=rules.filter(r=>r.status==='FAIL').length;
  const warnings=rules.filter(r=>r.status==='WARN').length;
  return {status:failures?'FAIL':warnings?'WARN':'PASS',failures,warnings,rules,caseRegressions,caseImprovements,passRateDelta,provenanceDelta,latencyIncreasePercent,costIncreasePercent};
}
