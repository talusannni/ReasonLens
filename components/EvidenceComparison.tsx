'use client';

import {useMemo, useState} from 'react';
import type {Trace} from '../lib/types';
import {compareEvidence, getCapturedLlmInput, type EvidenceDiffItem} from '../lib/evidence-diff';

function Chunk({item, label}:{item:EvidenceDiffItem;label:'before'|'after'}){
 const evidence=item[label];
 if(!evidence)return null;
 return <div className="evidence-diff-chunk">
  <div className="evidence-diff-chunk-head">
   <strong>{evidence.title}</strong>
   <span>#{evidence.rank}{evidence.score!==null? ` · score ${evidence.score}`:''}</span>
  </div>
  {evidence.source&&<small>Source: {evidence.source}</small>}
  <p>{evidence.content||'(No content captured)'}</p>
 </div>;
}

export default function EvidenceComparison({a,b}:{a:Trace;b:Trace}){
 const [showUnchanged,setShowUnchanged]=useState(false);
 const report=useMemo(()=>compareEvidence(a,b),[a,b]);
 const inputA=getCapturedLlmInput(a),inputB=getCapturedLlmInput(b);
 const contextLabel=(trace:Trace,value:string|null)=>{
  if(!value)return 'not captured';
  if(trace.nodes.some(node=>node.kind==='model'))return 'captured from LLM request';
  if(trace.nodes.some(node=>node.kind==='analysis'&&typeof node.metadata?.contextText==='string'))return 'prepared context · LLM skipped';
  return 'available';
 };
 const visible=report.items.filter(item=>showUnchanged||item.kind!=='unchanged');
 return <section className="evidence-comparison">
  <div className="evidence-comparison-head">
   <div><div className="eyebrow">RETRIEVAL DEBUG · NO NEW LLM CALL</div><h3>Evidence diff</h3><p>Compares evidence already captured in these traces. This view does not rerun either retriever.</p></div>
   <label className="evidence-show-unchanged"><input type="checkbox" checked={showUnchanged} onChange={e=>setShowUnchanged(e.target.checked)}/> Show unchanged</label>
  </div>
  <div className="evidence-diff-stats">
   <div><span>BASELINE EVIDENCE</span><strong>{report.baselineCount}</strong></div>
   <div><span>CURRENT EVIDENCE</span><strong>{report.currentCount}</strong></div>
   <div><span>ADDED</span><strong className="added-text">+{report.added}</strong></div>
   <div><span>REMOVED</span><strong className="removed-text">−{report.removed}</strong></div>
   <div><span>CHANGED</span><strong className="changed-text">{report.changed}</strong></div>
  </div>
  <div className="evidence-run-pair">
   <article><span>BASELINE RETRIEVAL</span><strong>{report.retrieverA} · top-k {report.topKA??'n/a'}</strong><p>{report.queryA}</p></article>
   <article><span>CURRENT RETRIEVAL</span><strong>{report.retrieverB} · top-k {report.topKB??'n/a'}</strong><p>{report.queryB}</p></article>
  </div>
  <div className="evidence-diff-list">
   {visible.map((item,index)=><article key={item.key} className={'evidence-diff-item '+item.kind}>
    <div className="evidence-diff-item-title"><strong>{item.kind.toUpperCase()}</strong><span>{item.changes.join(' · ')}</span></div>
    <div className="evidence-diff-columns">
     <div><label>BASELINE</label><Chunk item={item} label="before"/></div>
     <div><label>CURRENT</label><Chunk item={item} label="after"/></div>
    </div>
   </article>)}
   {visible.length===0&&<div className="evidence-diff-empty">No evidence changes detected in the captured traces.</div>}
  </div>
  <div className="evidence-contexts">
   <div className="evidence-context-title"><h4>LLM input / prepared context</h4><span>Read-only inspection</span></div>
   <div className="evidence-run-pair">
    <details><summary>Baseline · {contextLabel(a,inputA)}</summary><pre>{inputA||'This trace does not include inputMessages or inputText on the model node. Instrument the actual model request to capture the exact context sent.'}</pre></details>
    <details><summary>Current · {contextLabel(b,inputB)}</summary><pre>{inputB||'This trace does not include inputMessages or inputText on the model node. Instrument the actual model request to capture the exact context sent.'}</pre></details>
   </div>
  </div>
 </section>;
}
