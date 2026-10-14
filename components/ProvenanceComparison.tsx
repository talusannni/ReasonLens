'use client';
import type {Trace} from '../lib/types';
import {compareProvenance,isProvenanceComparable,type ProvenanceClaimDiff} from '../lib/provenance-regression';
import {isRetrievalOnlyTrace} from '../lib/evidence-diff';

function Diff({item}:{item:ProvenanceClaimDiff}){
 const claim=item.claimB||item.claimA||item.key;
 return <article className={"provenance-diff "+item.kind}>
  <div className="provenance-diff-top"><strong>{claim}</strong><span>{item.kind}</span></div>
  <p>{item.reason}</p>
  <div className="provenance-diff-meta">{item.statusA&&<span>Run A: <b>{item.statusA}</b></span>}{item.statusB&&<span>Run B: <b>{item.statusB}</b></span>}{item.addedEvidence.length>0&&<span>+{item.addedEvidence.length} evidence</span>}{item.removedEvidence.length>0&&<span>-{item.removedEvidence.length} evidence</span>}</div>
 </article>;
}

function ExperimentSummary({a,b,comparable,retrievalOnly,report}:{a:Trace;b:Trace;comparable:boolean;retrievalOnly:boolean;report:ReturnType<typeof compareProvenance>}) {
 const sameMode=a.mode===b.mode;
 const modeLabel=(mode:Trace['mode'])=>mode==='rag'?'RAG':mode==='agent'?'Agent':'Chat';
 const headline=retrievalOnly?'Answer-quality conclusion unavailable':!sameMode?'Cross-mode structural comparison':!comparable?'Structural comparison only':report.regressions.length>0?'Potential provenance regressions detected':report.improvements.length>0?'Potential provenance improvements detected':'No provenance regression detected';
 const detail=retrievalOnly?'At least one run stopped before answer generation. Compare retrieval/context changes only; answer quality is not comparable.':!sameMode?'Different execution modes use different evaluation contracts. Treat differences as structural; cross-mode quality-gate and provenance conclusions are not comparable.':!comparable?'These runs do not share an applicable provenance contract. Compare answer and trace structure without interpreting differences as quality gains or regressions.':report.regressions.length>0?report.regressions.length+' potential regression(s) need review. Trace signals are diagnostic and do not prove factual incorrectness.':report.improvements.length>0?report.improvements.length+' potential improvement(s) detected. Validate answer content before treating this as a quality improvement.':'No potential provenance regressions or improvements were detected in the comparable signals.';
 return <div className="experiment-summary">
  <div className="experiment-summary-heading"><div><div className="eyebrow">EXPERIMENT SUMMARY</div><h4>{headline}</h4></div><span className={sameMode&&comparable&&!retrievalOnly?'experiment-summary-status':'experiment-summary-status structural'}>{sameMode?'Same mode':'Cross mode'} · {comparable&&!retrievalOnly?'provenance comparable':'structural / N/A'}</span></div>
  <p>{detail}</p>
  <div className="experiment-summary-runs"><span><b>Run A</b> · {modeLabel(a.mode)}</span><span><b>Run B</b> · {modeLabel(b.mode)}</span></div>
  {comparable&&!retrievalOnly&&<div className="experiment-summary-counts"><span><b>{report.regressions.length}</b> potential regressions</span><span><b>{report.improvements.length}</b> potential improvements</span><span><b>{report.changes.length}</b> evidence changes</span></div>}
 </div>;
}
export default function ProvenanceComparison({a,b}:{a:Trace;b:Trace}){
 const report=compareProvenance(a,b);
 const retrievalOnly=isRetrievalOnlyTrace(a)||isRetrievalOnlyTrace(b);
 const comparable=isProvenanceComparable(a,b);
 if(!comparable){
  const chatOnly=a.mode==='chat'&&b.mode==='chat';
  const heading=retrievalOnly?'Claim provenance not evaluated':chatOnly?'Claim changes · structural comparison':'Provenance comparison not applicable';
  const explanation=retrievalOnly
   ?'At least one run intentionally stopped before LLM generation. With no generated claims or answer, claim-level provenance deltas would be misleading.'
   :chatOnly
    ?'These are chat traces without an evidence-provenance contract. Added or removed claims are structural differences between answers, not verified quality regressions or improvements.'
    :'At least one trace has no applicable provenance contract, so provenance scores and claim-status regressions cannot be compared reliably.';
  return <section className="provenance-comparison not-evaluated">
   <ExperimentSummary a={a} b={b} comparable={comparable} retrievalOnly={retrievalOnly} report={report}/>
   <div className="provenance-comparison-head"><div><div className="eyebrow">TRACE COMPARISON</div><h3>{heading}</h3><p>{explanation}</p></div><div className="regression-score unchanged"><strong>N/A</strong><span>provenance delta</span></div></div>
   <div className="regression-stats"><span><b>{report.addedClaims}</b> claims added</span><span><b>{report.removedClaims}</b> claims removed</span><span><b>{report.evidenceAdded}</b> evidence nodes added</span><span><b>{report.evidenceRemoved}</b> evidence nodes removed</span></div>
   <div className="provenance-empty">{chatOnly?'Use the answer panels to compare the generated responses. Use a RAG trace with captured retrieval evidence to evaluate evidence support.':'Run comparable traces with explicit evidence support to inspect provenance regressions and improvements.'}</div>
  </section>;
 }
 const direction=report.scoreDelta>0?'improved':report.scoreDelta<0?'regressed':'unchanged';
 return <section className="provenance-comparison">
  <ExperimentSummary a={a} b={b} comparable={comparable} retrievalOnly={retrievalOnly} report={report}/>
  <div className="provenance-comparison-head"><div><div className="eyebrow">PROVENANCE COMPARISON</div><h3>Provenance changes</h3><p>Compares explicit claim support, evidence and contradictions. These structural signals help investigate regressions; they do not independently establish factual correctness.</p></div><div className={"regression-score "+direction}><strong>{report.scoreDelta>0?'+':''}{report.scoreDelta}</strong><span>provenance score</span></div></div>
  <div className="regression-stats"><span><b>{report.regressions.length}</b> potential regressions</span><span><b>{report.improvements.length}</b> potential improvements</span><span><b>{report.changes.length}</b> evidence changes</span><span><b>{report.addedClaims}</b> claims added</span><span><b>{report.removedClaims}</b> claims removed</span><span><b>{report.evidenceAdded}</b> evidence added</span><span><b>{report.evidenceRemoved}</b> evidence removed</span></div>
  {report.answerPathChanged&&<div className="regression-alert">Answer provenance path changed: <b>{report.answerPathA?'present':'missing'}</b> → <b>{report.answerPathB?'present':'missing'}</b>.</div>}
  {report.regressions.length>0&&<div className="provenance-diff-group"><h4>Potential regressions</h4>{report.regressions.map((x,i)=><Diff key={x.key+'r'+i} item={x}/>)}</div>}
  {report.improvements.length>0&&<div className="provenance-diff-group"><h4>Potential improvements</h4>{report.improvements.map((x,i)=><Diff key={x.key+'i'+i} item={x}/>)}</div>}
  {report.changes.length>0&&<div className="provenance-diff-group"><h4>Evidence changes</h4>{report.changes.map((x,i)=><Diff key={x.key+'c'+i} item={x}/>)}</div>}
  {!report.regressions.length&&!report.improvements.length&&!report.changes.length&&<div className="provenance-empty">No claim or evidence provenance changes detected.</div>}
 </section>;
}
