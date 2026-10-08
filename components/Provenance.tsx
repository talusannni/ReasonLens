'use client';
import type {Trace} from '../lib/types';
import {analyzeProvenance} from '../lib/provenance';

export default function Provenance({trace}:{trace:Trace}){
 const report=analyzeProvenance(trace), status=report.score>=85?'Strong':report.score>=60?'Partial':'Weak';
 return <section className="provenance-card">
  <div className="provenance-head"><div><div className="eyebrow">ANSWER PROVENANCE</div><h3>Evidence support audit</h3><p>Measures only explicit evidence, claims, contradictions and decisions recorded in this trace.</p></div>
   <div className={"provenance-score "+status.toLowerCase()}><strong>{report.score}</strong><span>/ 100 · {status}</span></div>
  </div>
  <div className="provenance-stats"><span><b>{report.supportedClaims}</b> supported claims</span><span><b>{report.unsupportedClaims}</b> unsupported</span><span><b>{report.contradictedClaims}</b> contradicted</span><span><b>{report.evidenceCount}</b> evidence nodes</span><span><b>{report.decisionCount}</b> decisions</span><span><b>{report.answerHasProvenance?'Yes':'No'}</b> answer path</span></div>
  {report.claims.length===0?<div className="provenance-empty">No explicit claim nodes were recorded. Instrument claims to enable answer-level provenance analysis.</div>:
   <div className="provenance-claims">{report.claims.map(claim=><article className={"provenance-claim "+claim.status} key={claim.claimId}>
    <div className="provenance-claim-top"><strong>{claim.claim}</strong><span>{claim.status}</span></div>
    <div className="provenance-claim-meta"><span>Confidence: {claim.confidence===null?'—':claim.confidence.toFixed(2)}</span><span>Evidence: {claim.evidence.length}</span>{claim.contradictions.length>0&&<span>Contradictions: {claim.contradictions.length}</span>}</div>
    {claim.evidence.length>0&&<div className="provenance-evidence"><span>Supported by</span>{claim.evidence.map(id=>{const n=trace.nodes.find(x=>x.id===id);return <code key={id}>{n?.label||id}</code>})}</div>}
    {claim.contradictions.length>0&&<div className="provenance-evidence contradiction"><span>Contradicted by</span>{claim.contradictions.map(id=>{const n=trace.nodes.find(x=>x.id===id);return <code key={id}>{n?.label||id}</code>})}</div>}
   </article>)}</div>}
 </section>;
}
