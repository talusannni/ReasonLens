'use client';
import type {Trace} from '../lib/types';
import {evaluateComparison,evaluateTrace,type QualityGateReport} from '../lib/quality-gates';

function Gate({report}:{report:QualityGateReport}){
 return <section className={`quality-gate ${report.status.toLowerCase()}`}>
  <div className="quality-gate-head">
   <div><div className="eyebrow">QUALITY GATE</div><h3>Observable quality checks</h3><p>Pass/fail decisions use only trace metrics, claims, evidence and explicit provenance.</p></div>
   <div className={`quality-status ${report.status.toLowerCase()}`}><strong>{report.status}</strong><span>{report.failures} failed · {report.warnings} warnings</span></div>
  </div>
  <div className="quality-rules">{report.rules.map(rule=><article className={`quality-rule ${rule.status.toLowerCase()}`} key={rule.id}>
   <div className="quality-rule-main"><strong>{rule.label}</strong><span>{rule.status}</span></div>
   <div className="quality-rule-meta"><span>Actual: <b>{rule.actual}</b></span><span>Threshold: <b>{rule.threshold}</b></span></div>
   <p>{rule.message}</p>
  </article>)}</div>
 </section>;
}

export default function QualityGate({trace,a,b}:{trace?:Trace;a?:Trace;b?:Trace}){
 const report=a&&b?evaluateComparison(a,b):trace?evaluateTrace(trace):null;
 return report?<Gate report={report}/>:null;
}
