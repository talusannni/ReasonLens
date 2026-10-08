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
 const [view,setView]=useState<'workspace'|'history'|'analysis'|'settings'>('workspace');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [search,setSearch]=useState('');
 const [compareIds,setCompareIds]=useState<string[]>([]);
 const [loadingHistory,setLoadingHistory]=useState(true);
 const [connected,setConnected]=useState(false);
 const [dashboardKey,setDashboardKey]=useState('');
 const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
 useEffect(()=>{setSidebarCollapsed(localStorage.getItem('reasonlens-sidebar-collapsed')==='1');},[]);
 function toggleSidebar(){setSidebarCollapsed(v=>{const next=!v;localStorage.setItem('reasonlens-sidebar-collapsed',next?'1':'0');return next;});}
 const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
 useEffect(()=>{setSidebarCollapsed(localStorage.getItem('reasonlens-sidebar-collapsed')==='1');},[]);
 function toggleSidebar(){setSidebarCollapsed(v=>{const next=!v;localStorage.setItem('reasonlens-sidebar-collapsed',next?'1':'0');return next;});}

 async function loadPersisted(){
  setLoadingHistory(true);
  try{
   const r=await fetch('/api/dashboard/traces',{cache:'no-store'});
   if(r.status===401){setConnected(false);return;}
   const d=await r.json();
   if(!r.ok)throw new Error(d.error||'Could not load traces');
   setHistory(Array.isArray(d.traces)?d.traces:[]);
   setConnected(true);
  }catch(e){setError(e instanceof Error?e.message:'Could not load persisted traces');}
  finally{setLoadingHistory(false);}
 }
 useEffect(()=>{loadPersisted();},[]);

 const visibleHistory=useMemo(()=>history.filter(t=>t.prompt.toLowerCase().includes(search.toLowerCase())||t.mode.includes(search.toLowerCase())),[history,search]);
 const compareTraces=useMemo(()=>compareIds.map(id=>history.find(t=>t.id===id)).filter(Boolean) as Trace[],[compareIds,history]);

 async function connect(){
  setError('');
  try{
   const r=await fetch('/api/dashboard/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:dashboardKey})});
   const d=await r.json();
   if(!r.ok)throw new Error(d.error||'Connection failed');
   setDashboardKey('');
   await loadPersisted();
  }catch(e){setError(e instanceof Error?e.message:'Connection failed');}
 }
 async function disconnect(){
  await fetch('/api/dashboard/login',{method:'DELETE'});
  setConnected(false);setHistory([]);setTrace(null);
 }
 async function run(){
  setBusy(true);setError('');
  try{
   const r=await fetch('/api/trace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,provider,mode})});
   const d=await r.json();if(!r.ok)throw new Error(d.error||'Request failed');
   setTrace(d);setHistory(h=>[d,...h.filter(x=>x.id!==d.id)].slice(0,30));
  }catch(e){setError(e instanceof Error?e.message:'Request failed')}
  finally{setBusy(false)}
 }
 function load(t:Trace){setTrace(t);setPrompt(t.prompt);setMode(t.mode);setView('workspace')}
 function exportTrace(){if(!trace)return;const blob=new Blob([JSON.stringify(trace,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`reasonlens-${trace.id}.json`;a.click();URL.revokeObjectURL(a.href)}
 function importTrace(e:React.ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const t=JSON.parse(String(reader.result)) as Trace;if(!t.id||!Array.isArray(t.nodes)||!Array.isArray(t.edges))throw new Error('Invalid trace');setTrace(t);setHistory(h=>[t,...h.filter(x=>x.id!==t.id)].slice(0,30));setView('workspace')}catch(err){setError(err instanceof Error?err.message:'Invalid trace file')}};reader.readAsText(file)}
 function toggleCompare(id:string){setCompareIds(ids=>ids.includes(id)?ids.filter(x=>x!==id):ids.length<2?[...ids,id]:[ids[1],id])}

 return <main className={"shell"+(sidebarCollapsed?" sidebar-collapsed":"")}>
  <aside className="sidebar"><button className="sidebar-toggle" onClick={toggleSidebar} aria-label={sidebarCollapsed?"Expand sidebar":"Collapse sidebar"} title={sidebarCollapsed?"Expand sidebar":"Collapse sidebar"}>{sidebarCollapsed?"›":"‹"}</button>
   <div className="brand"><span className="brand-full">Reason<span>Lens</span></span><span className="brand-mini">R</span></div>
   <div className="tagline">See how AI reaches an answer.</div>
   <nav>
    <button title="Workspace" className={view==='workspace'?'active':''} onClick={()=>setView('workspace')}><span>▦</span><b>Workspace</b></button>
    <button title="Trace history" className={view==='history'?'active':''} onClick={()=>setView('history')}><span>◷</span><b>Trace history</b></button>
    <button title="Run comparison" className={view==='analysis'?'active':''} onClick={()=>setView('analysis')}><span>↔</span><b>Run comparison</b></button>
    <button title="Settings" className={view==='settings'?'active':''} onClick={()=>setView('settings')}><span>⚙</span><b>Settings</b></button>
   </nav>
   <div className="side-bottom">
    <div className="status-dot"><i/>{connected?'Trace store connected':'Trace store not connected'}</div>
    <label className="import-link">Import trace<input type="file" accept="application/json" onChange={importTrace}/></label>
   </div>
  </aside>
  <section className="content">
   <header className="topbar"><div><div className="eyebrow">AI OBSERVABILITY WORKSPACE</div><h2>{view==='workspace'?'Trace explorer':view==='history'?'Trace history':view==='analysis'?'Run comparison':'Configuration'}</h2></div><div className="top-actions"><span className="connection"><i/> Local-first</span>{trace&&<button className="ghost" onClick={exportTrace}>Export JSON</button>}</div></header>

   {!connected&&<section className="connect-card"><div><div className="eyebrow">PERSISTED TRACE STORE</div><h3>Connect to your ReasonLens trace store</h3><p>Enter the same ReasonLens ingest key configured in Vercel. It is sent only to your ReasonLens deployment and stored as an HttpOnly session cookie.</p></div><div className="connect-row"><input type="password" value={dashboardKey} onChange={e=>setDashboardKey(e.target.value)} onKeyDown={e=>e.key==='Enter'&&connect()} placeholder="ReasonLens ingest key"/><button className="primary" onClick={connect} disabled={!dashboardKey}>Connect</button></div></section>}

   {view==='workspace'&&<div className="workspace">
    <section className="run-panel">
     <div className="section-title"><div><h3>Run a trace</h3><p>Capture the observable structure around an AI answer.</p></div></div>
     <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Ask a question or describe an AI workflow…" aria-label="Prompt"/>
     <div className="run-controls">
      <div className="mode-tabs">{modes.map(m=><button key={m.id} className={mode===m.id?'selected':''} onClick={()=>setMode(m.id)}><strong>{m.label}</strong><small>{m.description}</small></button>)}</div>
      <div className="run-row"><select value={provider} onChange={e=>setProvider(e.target.value)}><option value="mock">Demo engine — no key</option><option value="groq">Groq API</option></select><button className="primary" onClick={run} disabled={busy||!prompt.trim()}>{busy?'Running trace…':'Run trace'}</button></div>
     </div>
     {error&&<div className="error">{error}</div>}
    </section>
    {trace?<><div className="trace-header"><div><div className="eyebrow">TRACE {trace.id.slice(0,8)}</div><h3>{trace.mode.toUpperCase()} · {trace.model}</h3></div><div className="metrics"><span>{trace.nodes.length} nodes</span><span>{trace.edges.length} edges</span><span>{trace.metrics.latencyMs} ms</span><span>{trace.metrics.inputTokens+trace.metrics.outputTokens} tokens</span><span>${trace.metrics.estimatedCostUsd.toFixed(6)}</span></div></div><Graph trace={trace}/><section className="answer-card"><div><div className="eyebrow">OBSERVABLE RESULT</div><h3>Final answer</h3></div><p>{trace.answer}</p></section></>:<EmptyState onRun={()=>run()}/>}
   </div>}

   {view==='history'&&<section className="history-page"><div className="history-tools"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search traces…"/><span>{loadingHistory?'Loading…':visibleHistory.length+' traces'}</span><div className="history-actions">{connected&&<button className="ghost" onClick={loadPersisted}>Refresh</button>}{connected&&<button className="ghost" onClick={disconnect}>Disconnect</button>}</div></div>{visibleHistory.length===0?<EmptyState onRun={()=>setView('workspace')}/>:<div className="history-list">{visibleHistory.map(t=><div className="history-item" key={t.id}><button className="history-open" onClick={()=>load(t)}><div className="history-main"><strong>{t.prompt}</strong><small>{new Date(t.createdAt).toLocaleString()}</small></div><div className="history-meta"><b>{t.mode}</b><span>{t.nodes.length} nodes</span><span>{t.metrics.latencyMs} ms</span><span>${t.metrics.estimatedCostUsd.toFixed(6)}</span></div></button><label className="compare-check"><input type="checkbox" checked={compareIds.includes(t.id)} onChange={()=>toggleCompare(t.id)}/> Compare</label></div>)}</div>}</section>}

   {view==='analysis'&&<section className="analysis-page">
    <div className="analysis-toolbar"><div><h3>Compare two runs</h3><p>Select two traces from history to identify latency, token and cost differences.</p></div><button className="primary" disabled={compareTraces.length!==2} onClick={()=>setView('analysis')}>{compareTraces.length===2?'Comparison ready':'Select 2 traces'}</button></div>
    {compareTraces.length===2?<Comparison a={compareTraces[0]} b={compareTraces[1]}/>:<div className="empty compact"><div className="empty-icon">↔</div><h3>Select two traces</h3><p>Open Trace history, select two Compare checkboxes, then return here.</p><button className="primary" onClick={()=>setView('history')}>Choose traces</button></div>}
   </section>}

   {view==='settings'&&<section className="settings-page"><div className="settings-card"><div><h3>Provider</h3><p>ReasonLens uses Groq for real AI execution. The demo engine is available for local UI testing.</p></div><select value={provider} onChange={e=>setProvider(e.target.value)}><option value="mock">Demo engine</option><option value="groq">Groq API</option></select></div><div className="settings-card"><div><h3>Trace persistence</h3><p>Traces are stored in Supabase and loaded into the dashboard through an authenticated server session.</p></div><span className="badge">SUPABASE</span></div><div className="settings-card"><div><h3>Cost model</h3><p>Groq pricing is calculated from the model's reported input and output token usage.</p></div><span className="badge">LIVE</span></div><div className="settings-card"><div><h3>Model output policy</h3><p>ReasonLens visualizes structured, externally explainable artifacts. It does not request or expose private chain-of-thought.</p></div><span className="badge">SAFE</span></div></section>}
  </section>
 </main>
}

function Comparison({a,b}:{a:Trace;b:Trace}){
 const rows=[
  ['Mode',a.mode,b.mode],
  ['Model',a.model,b.model],
  ['Latency',a.metrics.latencyMs+' ms',b.metrics.latencyMs+' ms'],
  ['Input tokens',a.metrics.inputTokens.toLocaleString(),b.metrics.inputTokens.toLocaleString()],
  ['Output tokens',a.metrics.outputTokens.toLocaleString(),b.metrics.outputTokens.toLocaleString()],
  ['Total tokens',(a.metrics.inputTokens+a.metrics.outputTokens).toLocaleString(),(b.metrics.inputTokens+b.metrics.outputTokens).toLocaleString()],
  ['Estimated cost','$'+a.metrics.estimatedCostUsd.toFixed(6),'$'+b.metrics.estimatedCostUsd.toFixed(6)],
  ['Nodes',String(a.nodes.length),String(b.nodes.length)],
  ['Edges',String(a.edges.length),String(b.edges.length)]
 ];
 return <div className="comparison"><div className="comparison-head"><div><span>RUN A</span><strong>{a.prompt.slice(0,90)}</strong></div><div><span>RUN B</span><strong>{b.prompt.slice(0,90)}</strong></div></div><div className="comparison-table"><div className="comparison-row header"><b>Metric</b><b>Run A</b><b>Run B</b></div>{rows.map(r=><div className="comparison-row" key={r[0]}><span>{r[0]}</span><strong>{r[1]}</strong><strong>{r[2]}</strong></div>)}</div><div className="comparison-answers"><article><span>RUN A ANSWER</span><p>{a.answer}</p></article><article><span>RUN B ANSWER</span><p>{b.answer}</p></article></div></div>
}

function EmptyState({onRun}:{onRun:()=>void}){return <section className="empty"><div className="empty-icon">◈</div><h3>No trace selected</h3><p>Run a chat, RAG or agent trace to inspect how inputs, evidence, tools and decisions connect.</p><button className="primary" onClick={onRun}>Run demo trace</button></section>}
