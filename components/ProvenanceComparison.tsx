'use client';
import type {Trace} from '../lib/types';
import {compareProvenance,type ProvenanceClaimDiff} from '../lib/provenance-regression';
import {isRetrievalOnlyTrace} from '../lib/evidence-diff';
function Diff({item}:{item:ProvenanceClaimDiff}){
 const claim=item.claimB||item.claimA||item.key;
 return <article className={"provenance-diff "+item.kind}>
  <div className="provenance-diff-top"><strong>{claim}</strong><span>{item.kind}</span></div>
  <p>{item.reason}</p>
  <div className="provenance-diff-meta">{item.statusA&&<span>Run A: <b>{item.statusA}</b></span>}{item.statusB&&<span>Run B: <b>{item.statusB}</b></span>}{item.addedEvidence.length>0&&<span>+{item.addedEvidence.length} evidence</span>}{item.removedEvidence.length>0&&<span>-{item.removedEvidence.length} evidence</span>}</div>
 </article>;
}
export default function ProvenanceComparison({a,b}:{a:Trace;b:Trace}){
 if(isRetrievalOnlyTrace(a)||isRetrievalOnlyTrace(b)){
  return <section className="provenance-comparison not-evaluated">
   <div className="provenance-comparison-head"><div><div className="eyebrow">RAG REGRESSION ANALYSIS</div><h3>Claim provenance not evaluated</h3><p>At least one run intentionally stopped before LLM generation. With no generated claims or answer, claim-level provenance deltas would be misleading.</p></div></div>
   <div className="provenance-empty">Use the Evidence diff below to inspect added, removed, and changed retrieval results. Run two full pipeline traces to compare claim support and answer provenance.</div>
  </section>;
 }
 const report=compareProvenance(a,b),direction=report.scoreDelta>0?'improved':report.scoreDelta<0?'regressed':'unchanged';
 return <section className="provenance-comparison">
  <div className="provenance-comparison-head"><div><div className="eyebrow">RAG REGRESSION ANALYSIS</div><h3>Provenance changes</h3><p>Compares explicit claims, evidence and contradictions between the two observable traces.</p></div><div className={"regression-score "+direction}><strong>{report.scoreDelta>0?'+':''}{report.scoreDelta}</strong><span>provenance score</span></div></div>
  <div className="regression-stats"><span><b>{report.regressions.length}</b> regressions</span><span><b>{report.improvements.length}</b> improvements</span><span><b>{report.changes.length}</b> evidence changes</span><span><b>{report.addedClaims}</b> added claims</span><span><b>{report.removedClaims}</b> removed claims</span><span><b>{report.evidenceAdded}</b> evidence added</span><span><b>{report.evidenceRemoved}</b> evidence removed</span></div>
  {report.answerPathChanged&&<div className="regression-alert">Answer provenance path changed: <b>{report.answerPathA?'present':'missing'}</b> → <b>{report.answerPathB?'present':'missing'}</b>.</div>}
  {report.regressions.length>0&&<div className="provenance-diff-group"><h4>Regressions</h4>{report.regressions.map((x,i)=><Diff key={x.key+'r'+i} item={x}/>)}</div>}
  {report.improvements.length>0&&<div className="provenance-diff-group"><h4>Improvements</h4>{report.improvements.map((x,i)=><Diff key={x.key+'i'+i} item={x}/>)}</div>}
  {report.changes.length>0&&<div className="provenance-diff-group"><h4>Evidence changes</h4>{report.changes.map((x,i)=><Diff key={x.key+'c'+i} item={x}/>)}</div>}
  {!report.regressions.length&&!report.improvements.length&&!report.changes.length&&<div className="provenance-empty">No claim or evidence provenance changes detected.</div>}
 </section>;
}
