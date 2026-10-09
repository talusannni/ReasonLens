import type {Trace} from './types';
import {analyzeProvenance} from './provenance';
import {isRetrievalOnlyTrace} from './evidence-diff';

export type ExperimentGateStatus='PASS'|'WARN'|'FAIL';
export interface ExperimentRule {
 id:string; label:string; status:ExperimentGateStatus; actual:string; threshold:string; message:string;
}
export interface ExperimentVariantAnalysis {
 trace:Trace;
 baseline:Trace;
 status:ExperimentGateStatus;
 provenanceDelta:number|null;
 latencyIncreasePercent:number;
 costIncreasePercent:number;
 rules:ExperimentRule[];
}
const round=(n:number)=>Math.round(n*10)/10;
function increasePercent(before:number,after:number):number {
 if(before<=0)return after>0?100:0;
 return round((after-before)/Math.abs(before)*100);
}
function rank(status:Trace['status']){return status==='completed'?2:status==='running'?1:0;}

/** Pick the workflow root when available; otherwise use the earliest captured trace. */
export function getExperimentBaseline(traces:Trace[]):Trace|null {
 if(!traces.length)return null;
 return [...traces].sort((a,b)=>{
  const aRoot=a.lineage?.parentTraceId?1:0,bRoot=b.lineage?.parentTraceId?1:0;
  return aRoot-bRoot||a.createdAt.localeCompare(b.createdAt);
 })[0];
}

/** Compare one variant with the baseline using observable artifacts only. */
export function analyzeExperimentVariant(baseline:Trace,variant:Trace):ExperimentVariantAnalysis {
 const retrievalOnly=isRetrievalOnlyTrace(baseline)||isRetrievalOnlyTrace(variant);
 const provenanceDelta=retrievalOnly?null:round(analyzeProvenance(variant).score-analyzeProvenance(baseline).score);
 const latencyIncreasePercent=increasePercent(baseline.metrics.latencyMs,variant.metrics.latencyMs);
 const costIncreasePercent=increasePercent(baseline.metrics.estimatedCostUsd,variant.metrics.estimatedCostUsd);
 const statusRegression=rank(variant.status)<rank(baseline.status);
 const rules:ExperimentRule[]=[
  {id:'run-status',label:'Run status',status:statusRegression?'FAIL':'PASS',actual:variant.status,threshold:'No status regression',message:statusRegression?'Variant run status degraded relative to the baseline.':'Run status did not regress.'},
  {id:'provenance',label:'Provenance score',status:provenanceDelta!==null&&provenanceDelta < -5?'FAIL':'PASS',actual:provenanceDelta===null?'N/A':(provenanceDelta>0?'+':'')+provenanceDelta,threshold:'Drop no greater than 5 points',message:retrievalOnly?'Not evaluated because at least one trace is retrieval-only.':provenanceDelta!==null&&provenanceDelta < -5?'Variant provenance score dropped by more than 5 points.':'Provenance score stayed within the allowed drop.'},
  {id:'latency',label:'Latency',status:latencyIncreasePercent>25?'WARN':'PASS',actual:latencyIncreasePercent+'%',threshold:'Increase no greater than 25%',message:latencyIncreasePercent>25?'Variant latency increased by more than 25%.':'Latency stayed within the warning threshold.'},
  {id:'cost',label:'Estimated cost',status:costIncreasePercent>25?'WARN':'PASS',actual:costIncreasePercent+'%',threshold:'Increase no greater than 25%',message:costIncreasePercent>25?'Variant estimated cost increased by more than 25%.':'Estimated cost stayed within the warning threshold.'}
 ];
 const status:ExperimentGateStatus=rules.some(r=>r.status==='FAIL')?'FAIL':rules.some(r=>r.status==='WARN')?'WARN':'PASS';
 return {trace:variant,baseline,status,provenanceDelta,latencyIncreasePercent,costIncreasePercent,rules};
}

/** Group traces by workflow so variants created from the same root are analyzed together. */
export function analyzeExperiment(traces:Trace[]):{baseline:Trace|null;variants:ExperimentVariantAnalysis[]} {
 const baseline=getExperimentBaseline(traces);
 if(!baseline)return {baseline:null,variants:[]};
 return {baseline,variants:traces.filter(t=>t.id!==baseline.id).sort((a,b)=>a.createdAt.localeCompare(b.createdAt)).map(t=>analyzeExperimentVariant(baseline,t))};
}
