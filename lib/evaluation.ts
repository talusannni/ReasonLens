import type {Trace} from './types';
import {evaluateTrace,type QualityGateConfig,type QualityGateReport} from './quality-gates';

export interface EvaluationCase {
 id:string;
 name:string;
 prompt:string;
 traceId?:string;
 description?:string;
 tags?:string[];
}
export interface EvaluationCaseResult {
 caseId:string;
 caseName:string;
 traceId:string|null;
 status:'passed'|'warned'|'failed'|'missing';
 report:QualityGateReport|null;
}
export interface EvaluationRun {
 id:string; name:string; createdAt:string; dataset:EvaluationCase[]; totalCases:number; evaluatedCases:number; missingCases:number;
 passedCases:number; warnedCases:number; failedCases:number; passRate:number;
 averageProvenanceScore:number; totalLatencyMs:number; averageLatencyMs:number; totalCostUsd:number;
 results:EvaluationCaseResult[];
}
export interface EvaluationComparison {
 baseline:EvaluationRun; current:EvaluationRun; passRateDelta:number; provenanceDelta:number;
 latencyDeltaMs:number; costDeltaUsd:number; regressions:EvaluationCaseResult[]; improvements:EvaluationCaseResult[];
}
const normalize=(value:string)=>value.toLowerCase().replace(/[^a-z0-9]+/g,' ').trim().replace(/\s+/g,' ');
export function matchTrace(testCase:EvaluationCase,traces:Trace[]):Trace|null {
 if(testCase.traceId){return traces.find(t=>t.id===testCase.traceId) ?? null;}
 const wanted=normalize(testCase.prompt);
 return traces.find(t=>normalize(t.prompt)===wanted) ?? null;
}
export function evaluateDataset(name:string,cases:EvaluationCase[],traces:Trace[],config?:QualityGateConfig,id='eval_'+Date.now()):EvaluationRun {
 const results:EvaluationCaseResult[]=cases.map(testCase=>{
  const trace=matchTrace(testCase,traces);
  if(!trace)return {caseId:testCase.id,caseName:testCase.name,traceId:null,status:'missing',report:null};
  const report=evaluateTrace(trace,config);
  return {caseId:testCase.id,caseName:testCase.name,traceId:trace.id,status:report.status==='FAIL'?'failed':report.status==='WARN'?'warned':'passed',report};
 });
 const evaluated=results.filter(r=>r.report);
 const passedCases=results.filter(r=>r.status==='passed').length;
 const warnedCases=results.filter(r=>r.status==='warned').length;
 const failedCases=results.filter(r=>r.status==='failed').length;
 const scores=evaluated.map(r=>Number.parseInt(r.report!.rules.find(rule=>rule.id==='provenance-score')?.actual??'',10)).filter(Number.isFinite);
 const traceList=evaluated.map(r=>traces.find(t=>t.id===r.traceId)).filter(Boolean) as Trace[];
 const totalLatencyMs=traceList.reduce((sum,t)=>sum+t.metrics.latencyMs,0);
 const totalCostUsd=traceList.reduce((sum,t)=>sum+t.metrics.estimatedCostUsd,0);
 return {
  id,name,createdAt:new Date().toISOString(),dataset:cases,totalCases:cases.length,evaluatedCases:evaluated.length,
  missingCases:results.filter(r=>r.status==='missing').length,passedCases,warnedCases,failedCases,
  passRate:cases.length?Math.round(passedCases/cases.length*1000)/10:0,
  averageProvenanceScore:scores.length?Math.round(scores.reduce((a,b)=>a+b,0)/scores.length*10)/10:0,
  totalLatencyMs,averageLatencyMs:traceList.length?Math.round(totalLatencyMs/traceList.length):0,totalCostUsd,results
 };
}
export function compareEvaluationRuns(baseline:EvaluationRun,current:EvaluationRun):EvaluationComparison {
 const beforeMap=new Map(baseline.results.map(r=>[r.caseId,r]));
 const rank=(s:EvaluationCaseResult['status'])=>s==='passed'?3:s==='warned'?2:s==='failed'?1:0;
 const regressions:EvaluationCaseResult[]=[]; const improvements:EvaluationCaseResult[]=[];
 for(const now of current.results){
  const before=beforeMap.get(now.caseId); if(!before||now.status==='missing')continue;
  if(rank(now.status)<rank(before.status))regressions.push(now);
  if(rank(now.status)>rank(before.status))improvements.push(now);
 }
 return {baseline,current,passRateDelta:Math.round((current.passRate-baseline.passRate)*10)/10,
  provenanceDelta:Math.round((current.averageProvenanceScore-baseline.averageProvenanceScore)*10)/10,
  latencyDeltaMs:current.averageLatencyMs-baseline.averageLatencyMs,costDeltaUsd:current.totalCostUsd-baseline.totalCostUsd,
  regressions,improvements};
}
export const CORE_RAG_DATASET:EvaluationCase[]=[
 {id:'rag-sla',name:'SLA support claim',prompt:'Is premium support availability 99.9% monthly?',description:'Checks that the SLA claim is evidence-backed and contradiction-free.',tags:['rag','provenance']},
 {id:'rag-refund',name:'Refund policy',prompt:'Can the customer receive a refund under the policy?',description:'Checks answer provenance for a policy decision.',tags:['rag','policy']},
 {id:'rag-contract',name:'Contract conflict',prompt:'Does the customer contract guarantee the stated SLA?',description:'Checks detection of contradictory contractual evidence.',tags:['rag','contradiction']}
];
