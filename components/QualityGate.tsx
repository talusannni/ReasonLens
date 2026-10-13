'use client';
import type {Trace} from '../lib/types';
import {evaluateComparison,evaluateTrace,type QualityGateReport} from '../lib/quality-gates';
import {isRetrievalOnlyTrace} from '../lib/evidence-diff';

function Gate({report}:{report:QualityGateReport}){
 return <section className={`quality-gate ${report.status.toLowerCase()}`}>
  <div className="quality-gate-head">
   <div><div className="eyebrow">QUALITY GATE</div><h3>Observable quality checks</h3><p>Checks are selected for the trace mode. A PASS means the configured observable checks passed, not that factual correctness was independently proven.</p></div>
   <div className={`quality-status ${report.status.toLowerCase()}`}><strong>{report.status}</strong><span>{report.failures} failed · {report.warnings} warnings</span></div>
  </div>
  <div className="quality-rules">{report.rules.map(rule=><article className={`quality-rule ${rule.status.toLowerCase()}`} key={rule.id}>
   <div className="quality-rule-main"><strong>{rule.label}</strong><span>{rule.status}</span></div>
   <div className="quality-rule-meta"><span>Actual: <b>{rule.actual}</b></span><span>Threshold: <b>{rule.threshold}</b></span></div>
   <p>{rule.message}</p>
  </article>)}</div>
 </section>;
}

function NotEvaluated({comparison=false}:{comparison?:boolean}){
 return <section className="quality-gate not-evaluated">
  <div className="quality-gate-head">
   <div><div className="eyebrow">QUALITY GATE</div><h3>Answer quality not evaluated</h3>
    <p>{comparison?'At least one selected trace is a retrieval-only replay. Answer-level metrics are not comparable until both runs generate an answer.':'This trace intentionally stopped after retrieval and context assembly. No LLM answer or claims were generated.'}</p>
   </div>
   <div className="quality-status"><strong>N/A</strong><span>Not evaluated</span></div>
  </div>
  <div className="quality-not-evaluated-note">
   <strong>Use the Evidence diff above to inspect retrieval changes.</strong>
   <span>Run a full pipeline replay when you want to evaluate answer provenance, unsupported claims, contradictions, latency and generation cost.</span>
  </div>
 </section>;
}

export default function QualityGate({trace,a,b}:{trace?:Trace;a?:Trace;b?:Trace}){
 if(a&&b&&(isRetrievalOnlyTrace(a)||isRetrievalOnlyTrace(b)))return <NotEvaluated comparison/>;
 if(trace&&isRetrievalOnlyTrace(trace))return <NotEvaluated/>;
 const report=a&&b?evaluateComparison(a,b):trace?evaluateTrace(trace):null;
 return report?<Gate report={report}/>:null;
}
