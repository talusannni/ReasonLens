'use client';
import type {Trace} from '../lib/types';
import {analyzeProvenance,isProvenanceApplicable} from '../lib/provenance';
import {isRetrievalOnlyTrace} from '../lib/evidence-diff';

export default function Provenance({trace}:{trace:Trace}){
 if(isRetrievalOnlyTrace(trace)||!isProvenanceApplicable(trace)){
  const agent=trace.mode==='agent';
  return <section className="provenance-card">
   <div className="provenance-head"><div><div className="eyebrow">ANSWER PROVENANCE</div><h3>{agent?'Evidence support audit':'Evidence provenance'}</h3>
    <p>{isRetrievalOnlyTrace(trace)?'This trace stopped after retrieval and context assembly, before an answer was generated. Answer provenance cannot be scored yet.':agent?'This agent trace has no explicit evidence-to-claim support links. Execution lineage is evaluated separately.':'This chat trace has no explicit retrieval evidence. Evidence provenance is not applicable to a standalone LLM response.'}</p></div>
    <div className="provenance-score"><strong>N/A</strong><span>Not applicable</span></div>
   </div>
   <div className="provenance-empty">No evidence provenance score is assigned. This does not establish whether the answer is factually correct.</div>
  </section>;
 }
 const report=analyzeProvenance(trace), status=report.score>=85?'Strong':report.score>=60?'Partial':'Weak';
 return <section className="provenance-card">
  <div className="provenance-head"><div><div className="eyebrow">ANSWER PROVENANCE</div><h3>{trace.mode==='agent'?'Execution and evidence support audit':'Evidence support audit'}</h3><p>Measures explicit supporting sources, claims, contradictions and answer links recorded in this trace.</p></div>
   <div className={"provenance-score "+status.toLowerCase()}><strong>{report.score}</strong><span>/ 100 · {status}</span></div>
  </div>
  <div className="provenance-stats"><span><b>{report.supportedClaims}</b> supported claims</span><span><b>{report.unsupportedClaims}</b> unsupported</span><span><b>{report.contradictedClaims}</b> contradicted</span><span><b>{report.evidenceCount}</b> evidence nodes</span><span><b>{report.decisionCount}</b> decisions</span><span><b>{report.answerHasProvenance?'Yes':'No'}</b> answer path</span></div>
  {report.claims.length===0?<div className="provenance-empty">No explicit claim nodes were recorded. Instrument claims to enable answer-level provenance analysis.</div>:
   <div className="provenance-claims">{report.claims.map(claim=><article className={"provenance-claim "+claim.status} key={claim.claimId}>
    <div className="provenance-claim-top"><strong>{claim.claim}</strong><span>{claim.status}</span></div>
    <div className="provenance-claim-meta"><span>Confidence: {claim.confidence===null?'—':claim.confidence.toFixed(2)}</span><span>Supporting sources: {claim.evidence.length}</span>{claim.contradictions.length>0&&<span>Contradictions: {claim.contradictions.length}</span>}</div>
    {claim.evidence.length>0&&<div className="provenance-evidence"><span>Supported by</span>{claim.evidence.map(id=>{const n=trace.nodes.find(x=>x.id===id);return <code key={id}>{n?.label||id}</code>})}</div>}
    {claim.contradictions.length>0&&<div className="provenance-evidence contradiction"><span>Contradicted by</span>{claim.contradictions.map(id=>{const n=trace.nodes.find(x=>x.id===id);return <code key={id}>{n?.label||id}</code>})}</div>}
   </article>)}</div>}
 </section>;
}
