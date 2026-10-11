'use client';

import {useEffect,useMemo,useState} from 'react';
import Graph from '../../components/Graph';
import Provenance from '../../components/Provenance';
import ProvenanceComparison from '../../components/ProvenanceComparison';
import EvidenceComparison from '../../components/EvidenceComparison';
import QualityGate from '../../components/QualityGate';
import ExperimentAnalysis from '../../components/ExperimentAnalysis';
import {analyzeProvenance} from '../../lib/provenance';
import {isRetrievalOnlyTrace} from '../../lib/evidence-diff';
import {getTraceExecutionInfo} from '../../lib/trace-execution';
import {compareEvaluationRuns,CORE_RAG_DATASET,type EvaluationCase,type EvaluationRun} from '../../lib/evaluation';
import {evaluateEvaluationRegression} from '../../lib/evaluation-regression';
import type {Trace,TraceMode} from '../../lib/types';

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
 const [traceTab,setTraceTab]=useState<'overview'|'evidence'|'lineage'>('overview');
 const [lineageTraces,setLineageTraces]=useState<Trace[]>([]);
 const [pendingParentTraceId,setPendingParentTraceId]=useState<string|undefined>();
 const [history,setHistory]=useState<Trace[]>([]);
 const [historyLineageTraces,setHistoryLineageTraces]=useState<Trace[]>([]);
 const [historyLineageWorkflowId,setHistoryLineageWorkflowId]=useState<string|null>(null);
 const [historyLineageExpandedTraceId,setHistoryLineageExpandedTraceId]=useState<string|null>(null);
 const [historyLineageLoading,setHistoryLineageLoading]=useState(false);
 const [historyTotal,setHistoryTotal]=useState(0);
 const [historyFamilyCounts,setHistoryFamilyCounts]=useState<Record<string,number>>({});
 const [historyPage,setHistoryPage]=useState(1);
 const [historyPageSize,setHistoryPageSize]=useState(25);
 const [view,setView]=useState<'workspace'|'history'|'analysis'|'evaluations'|'settings'>('workspace');
 const [busy,setBusy]=useState(false);
 const [error,setError]=useState('');
 const [search,setSearch]=useState('');
 const [compareIds,setCompareIds]=useState<string[]>([]);
 const [loadingHistory,setLoadingHistory]=useState(true);
 const [connected,setConnected]=useState(false);
 const [dashboardKey,setDashboardKey]=useState('');
 const [authMode,setAuthMode]=useState<'key'|'sign-in'|'sign-up'>('key');
 const [accountEmail,setAccountEmail]=useState('');
 const [accountPassword,setAccountPassword]=useState('');
 const [workspaceName,setWorkspaceName]=useState('');
 const [connectNotice,setConnectNotice]=useState('');
 const [sidebarCollapsed,setSidebarCollapsed]=useState(false);
 const [evaluationRuns,setEvaluationRuns]=useState<EvaluationRun[]>([]);
 const [evaluationLoading,setEvaluationLoading]=useState(false);
 const [evaluationBusy,setEvaluationBusy]=useState(false);
 const [evaluationSelection,setEvaluationSelection]=useState<string[]>([]);
 const [evaluationCases,setEvaluationCases]=useState<EvaluationCase[]>(CORE_RAG_DATASET);
 useEffect(()=>{setSidebarCollapsed(localStorage.getItem('reasonlens-sidebar-collapsed')==='1');},[]);
 function toggleSidebar(){setSidebarCollapsed(v=>{const next=!v;localStorage.setItem('reasonlens-sidebar-collapsed',next?'1':'0');return next;});}


 async function loadPersisted(page=historyPage){
  setLoadingHistory(true);
  try{
   const params=new URLSearchParams({page:String(page),pageSize:String(historyPageSize),search,mode:historyModeFilter,status:historyStatusFilter,provider:historyProviderFilter,model:historyModelFilter,days:historyTimeFilter,sort:historySort,execution:historyExecutionFilter});
   const r=await fetch('/api/dashboard/traces?'+params.toString(),{cache:'no-store'});
   if(r.status===401){setConnected(false);window.location.replace('/login');return;}
   const d=await r.json();
   if(!r.ok)throw new Error(d.error||'Could not load traces');
   setHistory(Array.isArray(d.traces)?d.traces:[]);
   setHistoryTotal(Number(d.total)||0);
   setHistoryFamilyCounts(d.familyCounts&&typeof d.familyCounts==='object'?d.familyCounts:{});
   setHistoryPage(Number(d.page)||page);
   setConnected(true);
  }catch(e){setError(e instanceof Error?e.message:'Could not load persisted traces');}
  finally{setLoadingHistory(false);}
 }
 useEffect(()=>{loadPersisted();},[]);
 useEffect(()=>{if(!connected||!trace){setLineageTraces([]);return;}let active=true;fetch('/api/dashboard/trace-lineage?traceId='+encodeURIComponent(trace.id),{cache:'no-store'}).then(async r=>{const d=await r.json();if(active&&r.ok)setLineageTraces(Array.isArray(d.traces)?d.traces:[]);}).catch(()=>{if(active)setLineageTraces([]);});return()=>{active=false;};},[connected,trace?.id]);

 const [historyModeFilter,setHistoryModeFilter]=useState('all');
 const [historyExecutionFilter,setHistoryExecutionFilter]=useState('all');
 const [historyStatusFilter,setHistoryStatusFilter]=useState('all');
 const [historyProviderFilter,setHistoryProviderFilter]=useState('all');
 const [historyModelFilter,setHistoryModelFilter]=useState('all');
 const [historyTimeFilter,setHistoryTimeFilter]=useState('all');
 const [historySort,setHistorySort]=useState('newest');
 const historyProviders=useMemo(()=>Array.from(new Set(history.map(t=>t.provider))).sort(),[history]);
 const historyModels=useMemo(()=>Array.from(new Set(history.map(t=>t.model))).sort(),[history]);
 useEffect(()=>{if(view!=='history'||!connected)return;setHistoryPage(1);const timer=setTimeout(()=>{loadPersisted(1);},250);return()=>clearTimeout(timer);},[search,historyModeFilter,historyExecutionFilter,historyStatusFilter,historyProviderFilter,historyModelFilter,historyTimeFilter,historySort,historyPageSize,connected,view]);
 useEffect(()=>{if(view==='history'&&connected&&historyPage>1)loadPersisted(historyPage);},[historyPage]);
 const visibleHistory=history;
 const compareTraces=useMemo(()=>{const all=[...history,...lineageTraces,...historyLineageTraces,...(trace?[trace]:[])];const unique=new Map<string,Trace>(all.map(t=>[t.id,t] as const));return compareIds.map(id=>unique.get(id)).filter(Boolean) as Trace[];},[compareIds,history,historyLineageTraces,lineageTraces,trace]);

 async function loadEvaluations(){
  if(!connected)return; setEvaluationLoading(true);
  try{const r=await fetch('/api/evaluations',{cache:'no-store'});if(r.status===401)return;const d=await r.json();if(r.ok)setEvaluationRuns(Array.isArray(d.runs)?d.runs:[]);}
  catch(e){setError(e instanceof Error?e.message:'Could not load evaluations');}finally{setEvaluationLoading(false);}
 }
 async function runEvaluation(){
  setEvaluationBusy(true);setError('');
  try{const r=await fetch('/api/evaluations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Core RAG Quality Suite',cases:evaluationCases})});const d=await r.json();if(!r.ok)throw new Error(d.error||'Evaluation failed');setEvaluationRuns(rs=>[d.run,...rs.filter(x=>x.id!==d.run.id)]);setView('evaluations');}
  catch(e){setError(e instanceof Error?e.message:'Evaluation failed');}finally{setEvaluationBusy(false);}
 }
 function toggleEvaluation(id:string){setEvaluationSelection(ids=>ids.includes(id)?ids.filter(x=>x!==id):ids.length<2?[...ids,id]:[ids[1],id]);}
 function importEvaluationDataset(event:React.ChangeEvent<HTMLInputElement>){const file=event.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const parsed=JSON.parse(String(reader.result));const cases=Array.isArray(parsed)?parsed:parsed.cases;if(!Array.isArray(cases)||!cases.length)throw new Error('Dataset must be a non-empty JSON array or an object with a cases array.');if(cases.some((item:any)=>typeof item?.id!=='string'||typeof item?.name!=='string'||typeof item?.prompt!=='string'||(item?.traceId!==undefined&&typeof item.traceId!=='string')))throw new Error('Every case needs id, name and prompt.');setEvaluationCases(cases);setError('');}catch(e){setError(e instanceof Error?e.message:'Invalid evaluation dataset');}};reader.readAsText(file);event.target.value='';}
 useEffect(()=>{if(connected)loadEvaluations();},[connected]);
 async function connect(){
  setError('');setConnectNotice('');
  try{
   const r=await fetch('/api/dashboard/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({key:dashboardKey})});
   const d=await r.json();
   if(!r.ok)throw new Error(d.error||'Connection failed');
   setDashboardKey('');
   await loadPersisted();
   setConnected(true);
   await loadEvaluations();
  }catch(e){setError(e instanceof Error?e.message:'Connection failed');}
 }
 async function connectWithAccount(){
  setError('');setConnectNotice('');
  try{
   const r=await fetch('/api/dashboard/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:accountEmail,password:accountPassword})});
   const d=await r.json();
   if(!r.ok)throw new Error(d.error||'Sign-in failed');
   setAccountPassword('');setConnected(true);
   await loadPersisted();await loadEvaluations();
  }catch(e){setError(e instanceof Error?e.message:'Sign-in failed');}
 }
 async function createAccount(){
  setError('');setConnectNotice('');
  try{
   const r=await fetch('/api/dashboard/signup',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:accountEmail,password:accountPassword,workspaceName:workspaceName.trim()||'Personal workspace'})});
   const d=await r.json();
   if(!r.ok)throw new Error(d.error||'Account creation failed');
   setAccountPassword('');
   if(d.needsEmailConfirmation){
    setAuthMode('sign-in');
    setConnectNotice('Account created. Check your email to confirm your address, then sign in.');
    return;
   }
   setConnected(true);await loadPersisted();await loadEvaluations();
  }catch(e){setError(e instanceof Error?e.message:'Account creation failed');}
 }
 async function disconnect(){
  await fetch('/api/dashboard/auth',{method:'DELETE'});
  await fetch('/api/dashboard/login',{method:'DELETE'});
  setConnected(false);setHistory([]);setHistoryTotal(0);setHistoryPage(1);setTrace(null);setEvaluationRuns([]);setEvaluationSelection([]);
 }
 async function signOut(){
  try{await disconnect();}
  finally{window.location.assign('/login');}
 }
 async function run(){
  setBusy(true);setError('');
  try{
   const r=await fetch('/api/trace',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({prompt,provider,mode,parentTraceId:pendingParentTraceId})});
   const d=await r.json();if(!r.ok)throw new Error(d.error||'Request failed');
   setTrace(d);setTraceTab('overview');setHistory(h=>[d,...h.filter(x=>x.id!==d.id)].slice(0,30));setHistoryTotal(n=>n+1);setPendingParentTraceId(undefined);
  }catch(e){setError(e instanceof Error?e.message:'Request failed')}
  finally{setBusy(false)}
 }
 function load(t:Trace){setTrace(t);setTraceTab('overview');setPrompt(t.prompt);setMode(t.mode);setView('workspace')}
 function startVariant(t:Trace){setTrace(t);setTraceTab('overview');setPrompt(t.prompt);setMode(t.mode);setProvider(t.provider==='groq'?'groq':'mock');setPendingParentTraceId(t.id);setView('workspace');setError('')}
 function addTraceToEvaluation(t:Trace){setEvaluationCases(cases=>cases.some(item=>item.traceId===t.id)?cases:[...cases,{id:'trace-'+t.id,name:'Trace '+t.id.slice(0,8),prompt:t.prompt,traceId:t.id,description:'Pinned trace from lineage'}]);setView('evaluations');}
 function exportTrace(){if(!trace)return;const blob=new Blob([JSON.stringify(trace,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`reasonlens-${trace.id}.json`;a.click();URL.revokeObjectURL(a.href)}
 function importTrace(e:React.ChangeEvent<HTMLInputElement>){const file=e.target.files?.[0];if(!file)return;const reader=new FileReader();reader.onload=()=>{try{const t=JSON.parse(String(reader.result)) as Trace;if(!t.id||!Array.isArray(t.nodes)||!Array.isArray(t.edges))throw new Error('Invalid trace');setTrace(t);setTraceTab('overview');setHistory(h=>[t,...h.filter(x=>x.id!==t.id)].slice(0,30));setView('workspace')}catch(err){setError(err instanceof Error?err.message:'Invalid trace file')}};reader.readAsText(file)}
 function toggleCompare(id:string){setCompareIds(ids=>ids.includes(id)?ids.filter(x=>x!==id):ids.length<2?[...ids,id]:[ids[1],id])}
 function compareLineage(id:string){const next=compareIds.includes(id)?compareIds.filter(x=>x!==id):compareIds.length<2?[...compareIds,id]:[compareIds[1],id];setCompareIds(next);if(next.length===2)setView('analysis')}
 async function showHistoryLineage(t:Trace){
  const workflowId=t.lineage?.workflowId||t.id;
  if(historyLineageExpandedTraceId===t.id){setHistoryLineageWorkflowId(null);setHistoryLineageExpandedTraceId(null);setHistoryLineageTraces([]);return;}
  setHistoryLineageWorkflowId(workflowId);setHistoryLineageExpandedTraceId(t.id);setHistoryLineageLoading(true);setHistoryLineageTraces([]);
  try{
   const r=await fetch('/api/dashboard/trace-lineage?traceId='+encodeURIComponent(t.id),{cache:'no-store'});
   const d=await r.json();
   if(!r.ok)throw new Error(d.error||'Could not load related traces');
   setHistoryLineageTraces(Array.isArray(d.traces)?d.traces:[]);
  }catch(e){setError(e instanceof Error?e.message:'Could not load related traces');setHistoryLineageWorkflowId(null);setHistoryLineageExpandedTraceId(null);}
  finally{setHistoryLineageLoading(false);}
 }

 return <main className={"shell"+(sidebarCollapsed?" sidebar-collapsed":"")}>
  <aside className="sidebar"><button className="sidebar-toggle" onClick={toggleSidebar} aria-label={sidebarCollapsed?"Expand sidebar":"Collapse sidebar"} title={sidebarCollapsed?"Expand sidebar":"Collapse sidebar"}>{sidebarCollapsed?"›":"‹"}</button>
   <div className="brand"><span className="brand-full">Reason<span>Lens</span></span><span className="brand-mini">R</span></div>
   <div className="tagline">See how AI reaches an answer.</div>
   <nav>
    <button title="Workspace" className={view==='workspace'?'active':''} onClick={()=>setView('workspace')}><span>▦</span><b>Workspace</b></button>
    <button title="Trace history" className={view==='history'?'active':''} onClick={()=>setView('history')}><span>◷</span><b>Trace history</b></button>
    <button title="Run comparison" className={view==='analysis'?'active':''} onClick={()=>setView('analysis')}><span>↔</span><b>Run comparison</b></button>
    <button title="Evaluations" className={view==='evaluations'?'active':''} onClick={()=>setView('evaluations')}><span>✓</span><b>Evaluations</b></button>
    <button title="Settings" className={view==='settings'?'active':''} onClick={()=>setView('settings')}><span>⚙</span><b>Settings</b></button>
   </nav>
   <div className="side-bottom">
    <div className="status-dot"><i/>{connected?'Trace store connected':'Trace store not connected'}</div>
    <label className="import-link">Import trace<input type="file" accept="application/json" onChange={importTrace}/></label>
   </div>
  </aside>
  <section className="content">
   <header className="topbar"><div><div className="eyebrow">AI OBSERVABILITY WORKSPACE</div><h2>{view==='workspace'?'Trace explorer':view==='history'?'Trace history':view==='analysis'?'Run comparison':view==='evaluations'?'Evaluations':'Configuration'}</h2></div><div className="top-actions">{connected&&<button className="ghost" onClick={()=>void signOut()}>Sign out</button>}<span className="connection"><i/> Local-first</span>{trace&&<button className="ghost" onClick={exportTrace}>Export JSON</button>}</div></header>

   {!connected&&<section className="connect-card"><div><div className="eyebrow">PERSISTED TRACE STORE</div><h3>Connect to ReasonLens</h3><p>Sign in to a team workspace, create a workspace, or connect with an existing workspace API key.</p></div><div className="connect-row"><button className={authMode==='sign-in'?'primary':'ghost'} onClick={()=>{setAuthMode('sign-in');setError('');setConnectNotice('');}}>Team sign in</button><button className={authMode==='sign-up'?'primary':'ghost'} onClick={()=>{setAuthMode('sign-up');setError('');setConnectNotice('');}}>Create account</button><button className={authMode==='key'?'primary':'ghost'} onClick={()=>{setAuthMode('key');setError('');setConnectNotice('');}}>API key</button></div>{authMode==='key'?<div className="connect-row"><input type="password" value={dashboardKey} onChange={e=>setDashboardKey(e.target.value)} onKeyDown={e=>e.key==='Enter'&&connect()} placeholder="ReasonLens workspace API key"/><button className="primary" onClick={connect} disabled={!dashboardKey}>Connect</button></div>:<div className="connect-row">{authMode==='sign-up'&&<input type="text" value={workspaceName} onChange={e=>setWorkspaceName(e.target.value)} placeholder="Workspace name (optional)" maxLength={80}/>}<input type="email" autoComplete="email" value={accountEmail} onChange={e=>setAccountEmail(e.target.value)} placeholder="Email address" maxLength={320}/><input type="password" autoComplete={authMode==='sign-up'?'new-password':'current-password'} value={accountPassword} onChange={e=>setAccountPassword(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(authMode==='sign-up'?createAccount():connectWithAccount())} placeholder="Password (at least 8 characters)" maxLength={128}/><button className="primary" onClick={authMode==='sign-up'?createAccount:connectWithAccount} disabled={!accountEmail.trim()||accountPassword.length<8}>{authMode==='sign-up'?'Create workspace':'Sign in'}</button></div>}{connectNotice&&<div className="connect-notice" role="status">{connectNotice}</div>}{error&&<div className="error">{error}</div>}</section>}

   {view==='workspace'&&<div className="workspace">
    <section className="run-panel">
     <div className="section-title"><div><h3>Run a trace</h3><p>Capture the observable structure around an AI answer.</p></div></div>
     {pendingParentTraceId&&<div className="lineage-pending"><span>New run will branch from trace <code>{pendingParentTraceId.slice(0,8)}</code>. Modify the prompt or settings, then run the variant.</span><button className="ghost" onClick={()=>setPendingParentTraceId(undefined)}>Clear link</button></div>}
     <textarea value={prompt} onChange={e=>setPrompt(e.target.value)} placeholder="Ask a question or describe an AI workflow…" aria-label="Prompt"/>
     <div className="run-controls">
      <div className="mode-tabs">{modes.map(m=><button key={m.id} className={mode===m.id?'selected':''} onClick={()=>setMode(m.id)}><strong>{m.label}</strong><small>{m.description}</small></button>)}</div>
      <div className="run-row"><select value={provider} onChange={e=>setProvider(e.target.value)}><option value="mock">Demo engine — no key</option><option value="groq">Groq API</option></select><button className="primary" onClick={run} disabled={busy||!prompt.trim()}>{busy?'Running trace…':'Run trace'}</button></div>
     </div>
     {error&&<div className="error">{error}</div>}
    </section>
    {trace?<><div className="trace-header"><div><div className="eyebrow">TRACE {trace.id.slice(0,8)}</div><h3>{trace.mode.toUpperCase()} · {trace.model}</h3><span className={`execution-badge execution-${getTraceExecutionInfo(trace).kind}`} title={getTraceExecutionInfo(trace).detail}>{getTraceExecutionInfo(trace).label}</span><div className="trace-lineage-actions">{connected?<><button className="ghost" onClick={()=>startVariant(trace)}>Run variant from this trace</button><button className="ghost" onClick={()=>addTraceToEvaluation(trace)}>Add to evaluation</button></>:<small className="trace-local-note">Demo trace · connect your trace store to persist, branch, and evaluate runs.</small>}</div></div><div className="metrics"><span>{trace.nodes.length} nodes</span><span>{trace.edges.length} edges</span><span>{trace.metrics.latencyMs} ms</span><span>{trace.metrics.inputTokens+trace.metrics.outputTokens} tokens</span><span>${trace.metrics.estimatedCostUsd.toFixed(6)}</span></div></div><div className="trace-tabs" role="tablist" aria-label="Trace detail sections">
 <button role="tab" aria-selected={traceTab==='overview'} className={traceTab==='overview'?'active':''} onClick={()=>setTraceTab('overview')}><strong>Overview</strong><small>Answer and execution</small></button>
 <button role="tab" aria-selected={traceTab==='evidence'} className={traceTab==='evidence'?'active':''} onClick={()=>setTraceTab('evidence')}><strong>Evidence</strong><small>Provenance and quality</small></button>
 <button role="tab" aria-selected={traceTab==='lineage'} className={traceTab==='lineage'?'active':''} onClick={()=>setTraceTab('lineage')}><strong>Lineage</strong><small>Runs and regressions</small></button>
 </div>
 {traceTab==='overview'&&<section className="trace-tab-panel" role="tabpanel" aria-label="Overview"><section className="answer-card"><div><div className="eyebrow">OBSERVABLE RESULT</div><h3>Final answer</h3></div><p>{trace.answer||'No final answer was captured for this trace.'}</p></section><Graph trace={trace}/></section>}
 {traceTab==='evidence'&&<section className="trace-tab-panel" role="tabpanel" aria-label="Evidence"><Provenance trace={trace}/><QualityGate trace={trace}/></section>}
 {traceTab==='lineage'&&<section className="trace-tab-panel" role="tabpanel" aria-label="Lineage"><section className="lineage-panel"><div className="lineage-panel-head"><div><h3>Trace lineage</h3><p>Runs in this workflow. Each run is retained separately.</p></div><span>{lineageTraces.length||1} run{(lineageTraces.length||1)===1?'':'s'}</span></div><div className="lineage-list">{(lineageTraces.length?lineageTraces:[trace]).map((item,index)=><article key={item.id} className={'lineage-item'+(item.id===trace.id?' selected':'')}><div className="lineage-index">{index+1}</div><div className="lineage-item-main"><strong>{item.lineage?.parentTraceId?'Variant':'Workflow run'} · {item.id.slice(0,8)}</strong><span>{new Date(item.createdAt).toLocaleString()} · {item.mode.toUpperCase()} · {item.model}</span><p>{item.prompt}</p><small>{item.lineage?.parentTraceId?'Parent: '+item.lineage.parentTraceId.slice(0,8):'Baseline / root run'}{item.lineage?.configFingerprint?' · Config '+item.lineage.configFingerprint:''}</small></div><div className="lineage-item-actions"><button className="ghost" onClick={()=>load(item)}>Open</button><button className="ghost" onClick={()=>compareLineage(item.id)}>{compareIds.includes(item.id)?'Selected':'Compare'}</button><button className="ghost" onClick={()=>startVariant(item)}>Branch</button><button className="ghost" onClick={()=>addTraceToEvaluation(item)}>Evaluate</button></div></article>)}</div></section><ExperimentAnalysis traces={lineageTraces.length?lineageTraces:[trace]} onEvaluate={addTraceToEvaluation}/></section>}</>:<EmptyState onRun={()=>run()}/>}
   </div>}

   {view==='history'&&<section className="history-page">
    <div className="history-tools"><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search prompt, trace ID, provider, model…" aria-label="Search traces"/><span>{loadingHistory?'Loading…':(historyTotal===0?0:(historyPage-1)*historyPageSize+history.length)+'–'+Math.min(historyPage*historyPageSize,historyTotal)+' of '+historyTotal+' traces'}</span><div className="history-actions">{compareIds.length>0&&<button className="ghost" onClick={()=>setView('analysis')}>Compare {compareIds.length}</button>}{connected&&<button className="ghost" onClick={()=>loadPersisted()}>Refresh</button>}{connected&&<button className="ghost" onClick={disconnect}>Disconnect</button>}</div></div>
    <div className="history-filters">
     <label>Execution type<select value={historyExecutionFilter} onChange={e=>setHistoryExecutionFilter(e.target.value)}><option value="all">All execution types</option><option value="retrieval-only">Retrieval only</option><option value="full-pipeline">Pipeline · LLM executed</option><option value="llm-executed">LLM executed</option><option value="partial">Failed / partial</option><option value="no-llm">No LLM request captured</option></select></label>
     <label>Mode<select value={historyModeFilter} onChange={e=>setHistoryModeFilter(e.target.value)}><option value="all">All modes</option><option value="chat">Chat</option><option value="rag">RAG</option><option value="agent">Agent</option></select></label>
     <label>Status<select value={historyStatusFilter} onChange={e=>setHistoryStatusFilter(e.target.value)}><option value="all">All statuses</option><option value="completed">Completed</option><option value="failed">Failed</option><option value="running">Running</option></select></label>
     <label>Provider<select value={historyProviderFilter} onChange={e=>setHistoryProviderFilter(e.target.value)}><option value="all">All providers</option>{historyProviders.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
     <label>Model<select value={historyModelFilter} onChange={e=>setHistoryModelFilter(e.target.value)}><option value="all">All models</option>{historyModels.map(value=><option key={value} value={value}>{value}</option>)}</select></label>
     <label>Time range<select value={historyTimeFilter} onChange={e=>setHistoryTimeFilter(e.target.value)}><option value="all">Any time</option><option value="1">Last 24 hours</option><option value="7">Last 7 days</option><option value="30">Last 30 days</option></select></label>
     <label>Sort by<select value={historySort} onChange={e=>setHistorySort(e.target.value)}><option value="newest">Newest first</option><option value="oldest">Oldest first</option><option value="latency-desc">Slowest first</option><option value="latency-asc">Fastest first</option><option value="cost-desc">Highest cost</option><option value="cost-asc">Lowest cost</option></select></label>
     <button className="ghost history-reset" onClick={()=>{setSearch('');setHistoryModeFilter('all');setHistoryExecutionFilter('all');setHistoryStatusFilter('all');setHistoryProviderFilter('all');setHistoryModelFilter('all');setHistoryTimeFilter('all');setHistorySort('newest');setHistoryPage(1);}}>Reset filters</button>
    </div>
    {visibleHistory.length===0?<div className="empty compact"><div className="empty-icon">⌕</div><h3>No matching traces</h3><p>Change or reset your search and filters.</p><button className="ghost" onClick={()=>{setSearch('');setHistoryModeFilter('all');setHistoryExecutionFilter('all');setHistoryStatusFilter('all');setHistoryProviderFilter('all');setHistoryModelFilter('all');setHistoryTimeFilter('all');}}>Clear filters</button></div>:<div className="trace-table-wrap"><table className="trace-table"><thead><tr><th><span className="sr-only">Compare</span></th><th>Trace / prompt</th><th>Execution type</th><th>Mode</th><th>Status</th><th>Latency</th><th>Cost (USD)</th><th>Lineage</th><th>Created</th><th>Action</th></tr></thead><tbody>{visibleHistory.map(t=>{const info=getTraceExecutionInfo(t);return <><tr key={t.id}><td><input type="checkbox" aria-label={'Compare trace '+t.id.slice(0,8)} checked={compareIds.includes(t.id)} onChange={()=>toggleCompare(t.id)}/></td><td className="trace-table-prompt"><button onClick={()=>load(t)} title="Open trace details">{t.prompt}</button><small>{t.id.slice(0,8)} · {t.provider} · {t.model}</small></td><td><span className={'execution-badge execution-'+info.kind} title={info.detail}>{info.label}</span></td><td><span className="table-mode">{t.mode.toUpperCase()}</span></td><td><span className={'trace-status status-'+t.status}>{t.status}</span></td><td className="numeric">{t.metrics.latencyMs.toLocaleString()} ms</td><td className="numeric">${t.metrics.estimatedCostUsd.toFixed(6)}</td><td className="trace-lineage-cell"><div className="history-lineage-meta"><span className={'history-lineage-badge '+(t.lineage?.parentTraceId?'variant':'root')}>{t.lineage?.parentTraceId?'VARIANT':'ROOT'}</span><code>{(t.lineage?.workflowId||t.id).slice(0,8)}</code></div>{t.lineage?.parentTraceId&&<small className="history-parent-link">↳ parent <button onClick={()=>showHistoryLineage(t)} title={'Show workflow containing parent '+t.lineage.parentTraceId}>{t.lineage.parentTraceId.slice(0,8)}</button></small>}{(historyFamilyCounts[t.lineage?.workflowId||t.id]||0)>1&&<button className="ghost history-family-button" onClick={()=>showHistoryLineage(t)}>{historyLineageExpandedTraceId===t.id?'Hide family':'View family'}</button>}</td><td className="trace-date">{new Date(t.createdAt).toLocaleString()}</td><td><button className="ghost trace-open-action" onClick={()=>load(t)}>Open</button></td></tr>{historyLineageExpandedTraceId===t.id&&<tr key={t.id+'-family'} className="history-family-row"><td colSpan={10}>{historyLineageWorkflowId===(t.lineage?.workflowId||t.id)&&<section className="history-family-panel"><div className="history-family-head"><div><div className="eyebrow">RELATED TRACE FAMILY</div><h3>Workflow {historyLineageWorkflowId.slice(0,8)}</h3><p>Baseline and variants stay linked even when they appear on different history pages.</p></div><button className="ghost" onClick={()=>{setHistoryLineageWorkflowId(null);setHistoryLineageExpandedTraceId(null);setHistoryLineageTraces([]);}}>Close</button></div>{historyLineageLoading?<p className="history-family-loading">Loading related traces…</p>:historyLineageTraces.length===0?<p className="history-family-loading">No related traces found.</p>:<div className="history-family-list">{historyLineageTraces.map((item,index)=><article key={item.id} className={'history-family-item '+(item.lineage?.parentTraceId?'is-variant':'is-root')}><div className="history-family-tree" aria-hidden="true">{item.lineage?.parentTraceId?'↳':'●'}</div><div className="history-family-main"><div className="history-family-title"><span className={'history-lineage-badge '+(item.lineage?.parentTraceId?'variant':'root')}>{item.lineage?.parentTraceId?'VARIANT':'BASELINE'}</span><strong>{item.id.slice(0,8)}</strong><small>{new Date(item.createdAt).toLocaleString()}</small></div><p>{item.prompt}</p><small>{item.mode.toUpperCase()} · {item.model} · {item.metrics.latencyMs.toLocaleString()} ms · ${item.metrics.estimatedCostUsd.toFixed(6)}{item.lineage?.parentTraceId?' · Parent '+item.lineage.parentTraceId.slice(0,8):' · Root run'}</small></div><div className="history-family-actions"><button className="ghost" onClick={()=>load(item)}>Open</button><button className="ghost" onClick={()=>compareLineage(item.id)}>{compareIds.includes(item.id)?'Selected':'Compare'}</button></div></article>)}</div>}</section>}</td></tr>}</>})}</tbody></table></div>}
    
    <div className="history-pagination"><div className="history-page-size"><label htmlFor="trace-page-size">Rows per page</label><select id="trace-page-size" value={historyPageSize} onChange={e=>{setHistoryPageSize(Number(e.target.value));setHistoryPage(1);}}><option value={10}>10</option><option value={25}>25</option><option value={50}>50</option><option value={100}>100</option></select><span>{historyTotal} total traces</span></div><div className="history-page-controls"><button className="ghost" disabled={historyPage<=1||loadingHistory} onClick={()=>setHistoryPage(p=>Math.max(1,p-1))}>Previous</button><span>Page {historyPage} of {Math.max(1,Math.ceil(historyTotal/historyPageSize))}</span><button className="ghost" disabled={historyPage>=Math.ceil(historyTotal/historyPageSize)||loadingHistory} onClick={()=>setHistoryPage(p=>p+1)}>Next</button></div></div>
   </section>}

   {view==='analysis'&&<section className="analysis-page">
    <div className="analysis-toolbar"><div><h3>Compare two runs</h3><p>Select two traces from history to identify latency, token and cost differences.</p></div><button className="primary" disabled={compareTraces.length!==2} onClick={()=>setView('analysis')}>{compareTraces.length===2?'Comparison ready':'Select 2 traces'}</button></div>
    {compareTraces.length===2?<Comparison a={compareTraces[0]} b={compareTraces[1]}/>:<div className="empty compact"><div className="empty-icon">↔</div><h3>Select two traces</h3><p>Open Trace history, select two Compare checkboxes, then return here.</p><button className="primary" onClick={()=>setView('history')}>Choose traces</button></div>}
   </section>}

   {view==='evaluations'&&<EvaluationPage runs={evaluationRuns} dataset={evaluationCases} loading={evaluationLoading} busy={evaluationBusy} selection={evaluationSelection} onRun={runEvaluation} onToggle={toggleEvaluation} onImport={importEvaluationDataset}/>}

   {view==='settings'&&<section className="settings-page"><div className="settings-card"><div><h3>Provider</h3><p>ReasonLens uses Groq for real AI execution. The demo engine is available for local UI testing.</p></div><select value={provider} onChange={e=>setProvider(e.target.value)}><option value="mock">Demo engine</option><option value="groq">Groq API</option></select></div><div className="settings-card"><div><h3>Trace persistence</h3><p>Traces are stored in Supabase and loaded into the dashboard through an authenticated server session.</p></div><span className="badge">SUPABASE</span></div><div className="settings-card"><div><h3>Cost model</h3><p>Groq pricing is calculated from the model's reported input and output token usage.</p></div><span className="badge">LIVE</span></div><div className="settings-card"><div><h3>Model output policy</h3><p>ReasonLens visualizes structured, externally explainable artifacts. It does not request or expose private chain-of-thought.</p></div><span className="badge">SAFE</span></div></section>}
  </section>
 </main>
}

function EvaluationPage({runs,dataset,loading,busy,selection,onRun,onToggle,onImport}:{runs:EvaluationRun[];dataset:EvaluationCase[];loading:boolean;busy:boolean;selection:string[];onRun:()=>void;onToggle:(id:string)=>void;onImport:(event:React.ChangeEvent<HTMLInputElement>)=>void}){
 const selected=selection.map(id=>runs.find(r=>r.id===id)).filter(Boolean) as EvaluationRun[];
 const latest=runs[0];
 function exportEvaluationRun(run:EvaluationRun){const blob=new Blob([JSON.stringify(run,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`reasonlens-evaluation-${run.id}.json`;a.click();URL.revokeObjectURL(url);}
 const comparison=selected.length===2?compareEvaluationRuns(selected[0],selected[1]):null;
 const regressionGate=selected.length===2?evaluateEvaluationRegression(selected[0],selected[1]):null;
 return <section className="evaluation-page">
  <div className="evaluation-toolbar"><div><div className="eyebrow">EVALUATION DATASET</div><h3>Evaluation dataset</h3><p>{dataset.length} cases · Evaluate captured traces against observable provenance, contradiction, latency and cost gates.</p></div><div className="evaluation-toolbar-actions"><label className="ghost evaluation-import">Import JSON<input type="file" accept="application/json" onChange={onImport}/></label><button className="primary" onClick={onRun} disabled={busy}>{busy?'Evaluating…':'Run evaluation'}</button></div></div>
  {loading?<div className="empty compact"><h3>Loading evaluations…</h3></div>:!runs.length?<div className="empty compact"><div className="empty-icon">✓</div><h3>No evaluation runs yet</h3><p>Run the benchmark against the traces currently stored in ReasonLens.</p><button className="primary" onClick={onRun} disabled={busy}>{busy?'Evaluating…':'Run first evaluation'}</button></div>:<>
   {latest&&<div className="evaluation-summary"><div><span>STATUS</span><strong className={latest.failedCases?'bad':latest.warnedCases?'warn':'good'}>{latest.failedCases?'FAIL':latest.warnedCases?'WARN':'PASS'}</strong></div><div><span>PASS RATE</span><strong>{latest.passRate}%</strong></div><div><span>PROVENANCE</span><strong>{latest.averageProvenanceScore}/100</strong></div><div><span>CASES</span><strong>{latest.evaluatedCases}/{latest.totalCases}</strong></div><div><span>LATENCY AVG</span><strong>{latest.averageLatencyMs} ms</strong></div><div><span>COST</span><strong>{latest.totalCostUsd.toFixed(6)} USD</strong></div></div>}
   <div className="evaluation-card"><div className="evaluation-card-head"><div><h3>Evaluation history</h3><p>Select two runs to compare benchmark quality over time.</p></div><span>{runs.length} runs</span></div><div className="evaluation-list">{runs.map(run=><div className="evaluation-item" key={run.id}><label><input type="checkbox" checked={selection.includes(run.id)} onChange={()=>onToggle(run.id)}/><div><strong>{run.name}</strong><small>{new Date(run.createdAt).toLocaleString()}</small></div></label><div className="evaluation-item-metrics"><b className={run.failedCases?'bad':run.warnedCases?'warn':'good'}>{run.failedCases?'FAIL':run.warnedCases?'WARN':'PASS'}</b><span>{run.passRate}% pass</span><span>{run.averageProvenanceScore}/100 provenance</span><span>{run.evaluatedCases}/{run.totalCases} cases</span></div><button className="ghost evaluation-export" onClick={()=>exportEvaluationRun(run)} aria-label={'Export '+run.name+' as JSON'}>Export JSON</button></div>)}</div></div>
   {latest&&<div className="evaluation-card"><div className="evaluation-card-head"><div><h3>Latest case results</h3><p>Missing cases are not silently counted as passes.</p></div></div><div className="evaluation-cases">{latest.results.map(result=><article className={'evaluation-case '+result.status} key={result.caseId}><div><strong>{result.caseName}</strong><small>{result.traceId?result.traceId.slice(0,8):'No matching trace'}</small></div><b>{result.status.toUpperCase()}</b></article>)}</div></div>}
   {comparison&&<div className="evaluation-card"><div className="evaluation-card-head"><div><h3>Baseline vs current regression gate</h3><p>{selected[0].name} → {selected[1].name}. The first selected run is the baseline; the second is the current run.</p></div><strong className={regressionGate?.status==='FAIL'?'bad':regressionGate?.status==='WARN'?'warn':'good'}>{regressionGate?.status}</strong></div><div className="evaluation-summary compact-summary"><div><span>PASS RATE DELTA</span><strong>{comparison.passRateDelta>=0?'+':''}{comparison.passRateDelta}%</strong></div><div><span>PROVENANCE DELTA</span><strong>{comparison.provenanceDelta>=0?'+':''}{comparison.provenanceDelta}</strong></div><div><span>LATENCY DELTA</span><strong>{comparison.latencyDeltaMs>=0?'+':''}{comparison.latencyDeltaMs} ms</strong></div><div><span>COST DELTA</span><strong>{comparison.costDeltaUsd>=0?'+':''}{comparison.costDeltaUsd.toFixed(6)} USD</strong></div></div><div className="regression-gate-rules">{regressionGate?.rules.map(rule=><article className={'regression-gate-rule '+rule.status.toLowerCase()} key={rule.id}><div><strong>{rule.label}</strong><small>{rule.message}</small></div><span>{rule.status}</span><b>{rule.actual}</b><small>{rule.threshold}</small></article>)}</div>{(regressionGate?.caseRegressions.length||comparison.regressions.length)>0&&<div className="evaluation-regressions">{(regressionGate?.caseRegressions||comparison.regressions).map(item=><div key={item.caseId}><b>REGRESSION</b><span>{item.caseName}</span><small>Quality gate status degraded.</small></div>)}</div>}{regressionGate?.caseImprovements.length ? <div className="evaluation-regressions improvements">{regressionGate.caseImprovements.map(item=><div key={item.caseId}><b>IMPROVEMENT</b><span>{item.caseName}</span><small>Quality gate status improved.</small></div>)}</div>:null}</div>}
  </>}
 </section>
}

function Comparison({a,b}:{a:Trace;b:Trace}){
 const answerQualityAvailable=!isRetrievalOnlyTrace(a)&&!isRetrievalOnlyTrace(b);
 const pA=analyzeProvenance(a),pB=analyzeProvenance(b);
 const qualityValue=(value:string)=>answerQualityAvailable?value:'N/A';
 const rows=[
  ['Prompt',a.prompt.slice(0,90),b.prompt.slice(0,90)],
  ['Provider',a.provider,b.provider],
  ['Mode',a.mode,b.mode],
  ['Model',a.model,b.model],
  ['Workflow',a.lineage?.workflowId?.slice(0,8)||a.id.slice(0,8),b.lineage?.workflowId?.slice(0,8)||b.id.slice(0,8)],
  ['Parent trace',a.lineage?.parentTraceId?.slice(0,8)||'Root',b.lineage?.parentTraceId?.slice(0,8)||'Root'],
  ['Config fingerprint',a.lineage?.configFingerprint||'Not captured',b.lineage?.configFingerprint||'Not captured'],
  ['Latency',a.metrics.latencyMs+' ms',b.metrics.latencyMs+' ms'],
  ['Input tokens',a.metrics.inputTokens.toLocaleString(),b.metrics.inputTokens.toLocaleString()],
  ['Output tokens',a.metrics.outputTokens.toLocaleString(),b.metrics.outputTokens.toLocaleString()],
  ['Total tokens',(a.metrics.inputTokens+a.metrics.outputTokens).toLocaleString(),(b.metrics.inputTokens+b.metrics.outputTokens).toLocaleString()],
  ['Estimated cost','$'+a.metrics.estimatedCostUsd.toFixed(6),'$'+b.metrics.estimatedCostUsd.toFixed(6)],
  ['Nodes',String(a.nodes.length),String(b.nodes.length)],
  ['Edges',String(a.edges.length),String(b.edges.length)],
  ['Provenance score',qualityValue(pA.score+'/100'),qualityValue(pB.score+'/100')],
  ['Supported claims',qualityValue(String(pA.supportedClaims)),qualityValue(String(pB.supportedClaims))],
  ['Unsupported claims',qualityValue(String(pA.unsupportedClaims)),qualityValue(String(pB.unsupportedClaims))],
  ['Contradicted claims',qualityValue(String(pA.contradictedClaims)),qualityValue(String(pB.contradictedClaims))]
 ];
 return <div className="comparison"><div className="comparison-head"><div><span>RUN A</span><strong>{a.prompt.slice(0,90)}</strong></div><div><span>RUN B</span><strong>{b.prompt.slice(0,90)}</strong></div></div><div className="comparison-table"><div className="comparison-row header"><b>Metric</b><b>Run A</b><b>Run B</b></div>{rows.map(r=><div className="comparison-row" key={r[0]}><span>{r[0]}</span><strong>{r[1]}</strong><strong>{r[2]}</strong></div>)}</div><ProvenanceComparison a={a} b={b}/><EvidenceComparison a={a} b={b}/><QualityGate a={a} b={b}/><div className="comparison-answers"><article><span>RUN A ANSWER</span><p>{a.answer|| (isRetrievalOnlyTrace(a)?'Not generated — retrieval-only replay.':'No answer captured.')}</p></article><article><span>RUN B ANSWER</span><p>{b.answer|| (isRetrievalOnlyTrace(b)?'Not generated — retrieval-only replay.':'No answer captured.')}</p></article></div></div>
}

function EmptyState({onRun}:{onRun:()=>void}){return <section className="empty"><div className="empty-icon">◈</div><h3>No trace selected</h3><p>Run a chat, RAG or agent trace to inspect how inputs, evidence, tools and decisions connect.</p><button className="primary" onClick={onRun}>Run demo trace</button></section>}
