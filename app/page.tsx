'use client';

import {useEffect,useMemo,useState} from 'react';
import Graph from '../components/Graph';
import type {Trace,TraceMode} from '../lib/types';

const starter='Should I use PostgreSQL or MongoDB for a multi-tenant SaaS application?';
const modes:Array<{id:TraceMode;label:string;description:string}>=[
 {id:'chat',label:'Chat trace',description:'Model request, structured claims and final answer'},
 {id:'rag',label:'RAG trace',description:'Retrieval, evidence, claims and citations'},
 {id:'agent',label:'Agent trace',description:'Plan, tool calls, execution and decision'}
];

export default function Home(){
 const [prompt,setPrompt]=useState(starter);
 const [mode,setMode]=useState<TraceMode>('rag');
 const [provider,setProvider]=useState('mock');
 const [trace,setTrace]=useState<Trace|null>(null);
 const [history,setHistory]=useState<Trace[]>([]);
 const [view,setView]=useState<'workspace'|'history'|'settings'>('workspace');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [search,setSearch]=useState('');

 useEffect(()=>{try{const raw=localStorage.getItem('reasonlens-history');if(raw)setHistory(JSON.parse(raw))}catch{}},[]);
 useEffect(()=>{try{localStorage.setItem('reasonlens-history',JSON.stringify(history.slice(0,20)))}catch{}},[history]);

 const visibleHistory=useMemo(()=>history.filter(t=>t.prompt.toLowerCase().includes(search.toLowerCase())||t.mode.includes(search.toLowerCase())),[history,search]);

 async function run(){
  setBusy(true);setError('');
  try{
   const r=await fetch('/api/trace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,provider,mode})});
   const d=await r.json();if(!r.ok)throw new Error(d.error||'Request failed');
   setTrace(d);setHistory(h=>[d,...h.filter(x=>x.id!==d.id)].slice(0,20));
  }catch(e){setError(e instanceof Error?e.message:'Request failed')}
  finally{setBusy(false)}
 }
 function load(t:Trace){setTrace(t);setPrompt(t.prompt);setMode(t.mode);setView('workspace')}
 function exportTrace(){if(!trace)return;const blob=new Blob([JSON.stringify(trace,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`reasonlens-${trace.id}.json`;a.click();URL.revokeObjectURL(a.href)}
 function importTrace(e:React.ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const t=JSON.parse(String(reader.result)) as Trace;if(!t.id||!Array.isArray(t.nodes)||!Array.isArray(t.edges))throw new Error('Invalid trace');setTrace(t);setHistory(h=>[t,...h.filter(x=>x.id!==t.id)].slice(0,20));setView('workspace')}catch(err){setError(err instanceof Error?err.message:'Invalid trace file')}};reader.readAsText(file)}

 return <main className="shell">
  <aside className="sidebar">
   <div className="brand">Reason<span>Lens</span></div>
   <div className="tagline">See how AI reaches an answer.</div>
   <nav>
    <button className={view==='workspace'?'active':''} onClick={()=>setView('workspace')}><span>▦</span> Workspace</button>
    <button className={view==='history'?'active':''} onClick={()=>setView('history')}><span>◷</span> Trace history</button>
    <button className={view==='settings'?'active':''} onClick={()=>setView('settings')}><span>⚙</span> Settings</button>
   </nav>
   <div className="side-bottom">
    <div className="status-dot"><i/> Demo engine online</div>
    <label className="import-link">Import trace<input type="file" accept="application/json" onChange={importTrace}/></label>
   </div>
  </aside>
  <section className="content">
   <header className="topbar"><div><div className="eyebrow">AI OBSERVABILITY WORKSPACE</div><h2>{view==='workspace'?'Trace explorer':view==='history'?'Trace history':'Configuration'}</h2></div><div className="top-actions"><span className="connection"><i/> Local-first</span>{trace&&<button className="ghost" onClick={exportTrace}>Export JSON</button>}</div></header>

   {view==='workspace'&&<div className="workspace">
    <section className="run-panel">
     <div className="section-title"><div><h3>Run a trace</h3><p>Capture the observable structure around an AI answer.</p></div></div>
     <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Ask a question or describe an AI workflow…" aria-label="Prompt"/>
     <div className="run-controls">
      <div className="mode-tabs">{modes.map(m=><button key={m.id} className={mode===m.id?'selected':''} onClick={()=>setMode(m.id)}><strong>{m.label}</strong><small>{m.description}</small></button>)}</div>
      <div className="run-row"><select value={provider} onChange={e=>setProvider(e.target.value)}><option value="mock">Demo engine — no key</option><option value="openai">OpenAI-compatible / Ollama</option></select><button className="primary" onClick={run} disabled={busy||!prompt.trim()}>{busy?'Running trace…':'Run trace'}</button></div>
     </div>
     {error&&<div className="error">{error}</div>}
    </section>
    {trace?<><div className="trace-header"><div><div className="eyebrow">TRACE {trace.id.slice(0,8)}</div><h3>{trace.mode.toUpperCase()} · {trace.model}</h3></div><div className="metrics"><span>{trace.nodes.length} nodes</span><span>{trace.edges.length} edges</span><span>{trace.metrics.latencyMs} ms</span><span>{trace.metrics.inputTokens+trace.metrics.outputTokens} tokens</span></div></div><Graph trace={trace}/><section className="answer-card"><div><div className="eyebrow">OBSERVABLE RESULT</div><h3>Final answer</h3></div><p>{trace.answer}</p></section></>:<EmptyState onRun={()=>run()}/>}
   </div>}

   {view==='history'&&<section className="history-page"><div className="history-tools"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search traces…"/><span>{visibleHistory.length} traces</span></div>{visibleHistory.length===0?<EmptyState onRun={()=>setView('workspace')}/>:<div className="history-list">{visibleHistory.map(t=><button key={t.id} onClick={()=>load(t)}><div className="history-main"><strong>{t.prompt}</strong><small>{new Date(t.createdAt).toLocaleString()}</small></div><div className="history-meta"><b>{t.mode}</b><span>{t.nodes.length} nodes</span><span>{t.metrics.latencyMs} ms</span></div></button>)}</div>}</section>}

   {view==='settings'&&<section className="settings-page"><div className="settings-card"><div><h3>Provider</h3><p>Choose the engine used when you run a trace.</p></div><select value={provider} onChange={e=>setProvider(e.target.value)}><option value="mock">Demo engine</option><option value="openai">OpenAI-compatible / Ollama</option></select></div><div className="settings-card"><div><h3>Trace privacy</h3><p>History is stored in this browser only. No trace database is required.</p></div><span className="badge">LOCAL</span></div><div className="settings-card"><div><h3>Model output policy</h3><p>ReasonLens visualizes structured, externally explainable artifacts. It does not request or expose private chain-of-thought.</p></div><span className="badge">SAFE</span></div></section>}
  </section>
 </main>
}

function EmptyState({onRun}:{onRun:()=>void}){return <section className="empty"><div className="empty-icon">◈</div><h3>No trace selected</h3><p>Run a chat, RAG or agent trace to inspect how inputs, evidence, tools and decisions connect.</p><button className="primary" onClick={onRun}>Run demo trace</button></section>}
