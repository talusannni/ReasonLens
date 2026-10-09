'use client';

import type {Trace} from '../lib/types';
import {analyzeExperiment} from '../lib/experiment-analysis';

export default function ExperimentAnalysis({traces,onEvaluate}:{traces:Trace[];onEvaluate?:(trace:Trace)=>void}){
 const analysis=analyzeExperiment(traces);
 if(!analysis.baseline)return null;
 const {baseline,variants}=analysis;
 const overall=variants.some(v=>v.status==='FAIL')?'FAIL':variants.some(v=>v.status==='WARN')?'WARN':'PASS';
 return <section className="experiment-analysis">
  <div className="experiment-analysis-head">
   <div><div className="eyebrow">EXPERIMENT REGRESSION GATE</div><h3>Baseline vs variants</h3><p>Each variant is compared with the workflow root using captured run status, provenance, latency and estimated cost.</p></div>
   <span className={'experiment-gate-status '+overall.toLowerCase()}>{variants.length?overall:'BASELINE'}</span>
  </div>
  <div className="experiment-baseline"><span>BASELINE · EXPERIMENT {baseline.lineage?.experimentId?.slice(0,8)||baseline.lineage?.workflowId?.slice(0,8)||baseline.id.slice(0,8)}</span><strong>{baseline.id.slice(0,8)} · {baseline.model}</strong><p>{baseline.prompt}</p><small>{new Date(baseline.createdAt).toLocaleString()} · {baseline.metrics.latencyMs} ms · ${baseline.metrics.estimatedCostUsd.toFixed(6)}</small></div>
  {!variants.length?<p className="experiment-empty">Run a variant from this trace to enable automatic regression analysis.</p>:<div className="experiment-variants">{variants.map(result=><article className="experiment-variant" key={result.trace.id}>
   <div className="experiment-variant-head"><div><strong>Variant {result.trace.id.slice(0,8)}</strong><small>{result.trace.model} · {new Date(result.trace.createdAt).toLocaleString()}</small></div><div className="experiment-variant-actions"><span className={'experiment-gate-status '+result.status.toLowerCase()}>{result.status}</span>{onEvaluate&&<button className="ghost" onClick={()=>onEvaluate(result.trace)}>Add to evaluation</button>}</div></div>
   <p className="experiment-variant-prompt">{result.trace.prompt}</p>
   <div className="experiment-deltas"><div><span>Provenance Δ</span><strong>{result.provenanceDelta===null?'N/A':(result.provenanceDelta>0?'+':'')+result.provenanceDelta}</strong></div><div><span>Latency</span><strong>{result.trace.metrics.latencyMs.toLocaleString()} ms ({result.latencyIncreasePercent>0?'+':''}{result.latencyIncreasePercent}%)</strong></div><div><span>Cost</span><strong>${result.trace.metrics.estimatedCostUsd.toFixed(6)} ({result.costIncreasePercent>0?'+':''}{result.costIncreasePercent}%)</strong></div></div>
   <div className="experiment-rules">{result.rules.map(rule=><div key={rule.id} className={'experiment-rule '+rule.status.toLowerCase()}><span>{rule.status==='FAIL'?'FAIL':rule.status==='WARN'?'WARN':'PASS'}</span><div><strong>{rule.label}</strong><small>{rule.message}</small></div><b>{rule.actual}</b></div>)}</div>
  </article>)}</div>}
  <p className="experiment-disclaimer">This gate evaluates observable artifacts only. Retrieval-only runs do not receive an answer-provenance score. Latency and cost increases are warnings; run-status and provenance regressions block the variant.</p>
 </section>;
}
