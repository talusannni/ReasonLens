'use client';
import {useEffect,useMemo,useRef,useState} from 'react';
import type {Trace,GraphNode} from '../lib/types';

const colors:Record<string,string>={
 prompt:'#7c3aed',analysis:'#2563eb',evidence:'#059669',claim:'#d97706',
 decision:'#dc2626',answer:'#111827',retrieval:'#0891b2',tool:'#9333ea',
 model:'#475569',warning:'#b91c1c'
};
type GraphView='all'|'path'|'evidence'|'tools';

export default function Graph({trace}:{trace:Trace}){
 const [selected,setSelected]=useState<GraphNode>(trace.nodes[0]);
 const [zoom,setZoom]=useState(1);
 const [view,setView]=useState<GraphView>('all');
 const canvasRef=useRef<HTMLDivElement>(null);

 useEffect(()=>{setSelected(trace.nodes[0]);setZoom(1);setView('all');},[trace.id]);

 const visible={nodes:trace.nodes,edges:trace.edges};
 const filtered=useMemo(()=>{
  if(view==='all')return visible;
  const nodeMap=new Map(trace.nodes.map(n=>[n.id,n]));
  if(view==='evidence'){
   const ids=new Set(trace.nodes.filter(n=>n.kind==='retrieval'||n.kind==='evidence'||n.kind==='claim'||n.kind==='prompt'||n.kind==='answer').map(n=>n.id));
   const edges=trace.edges.filter(e=>ids.has(e.source)&&ids.has(e.target));
   return {nodes:trace.nodes.filter(n=>ids.has(n.id)),edges};
  }
  if(view==='tools'){
   const ids=new Set(trace.nodes.filter(n=>n.kind==='tool'||n.kind==='analysis'||n.kind==='model'||n.kind==='decision'||n.kind==='prompt'||n.kind==='answer').map(n=>n.id));
   const edges=trace.edges.filter(e=>ids.has(e.source)&&ids.has(e.target));
   return {nodes:trace.nodes.filter(n=>ids.has(n.id)),edges};
  }
  const answer=trace.nodes.find(n=>n.kind==='answer')||trace.nodes[trace.nodes.length-1];
  const ids=new Set<string>(answer?[answer.id]:[]);
  let changed=true;
  while(changed){
   changed=false;
   trace.edges.forEach(e=>{
    if(ids.has(e.target)&&!ids.has(e.source)){ids.add(e.source);changed=true;}
   });
  }
  const edges=trace.edges.filter(e=>ids.has(e.source)&&ids.has(e.target));
  return {nodes:trace.nodes.filter(n=>ids.has(n.id)),edges};
 },[trace,view]);

 const positions=useMemo(()=>{
  const nodes=filtered.nodes,edges=filtered.edges;
  const levels:Record<string,number>={};
  const incoming=new Set(edges.map(e=>e.target));
  const q:Array<[string,number]>=nodes.filter(n=>!incoming.has(n.id)).map(n=>[n.id,0]);
  while(q.length){
   const [id,l]=q.shift()!;
   if(levels[id]!==undefined&&levels[id]<=l)continue;
   levels[id]=l;
   edges.filter(e=>e.source===id&&nodes.some(n=>n.id===e.target)).forEach(e=>q.push([e.target,l+1]));
  }
  nodes.forEach(n=>{if(levels[n.id]===undefined)levels[n.id]=0});
  const grouped:Record<number,GraphNode[]>={};
  nodes.forEach(n=>(grouped[levels[n.id]]??=[]).push(n));
  const out:Record<string,{x:number,y:number}>={};
  Object.entries(grouped).forEach(([level,list])=>{
   const columnHeight=(list.length-1)*96;
   const startY=Math.max(70,270-columnHeight/2);
   list.forEach((n,i)=>{out[n.id]={x:70+Number(level)*235,y:startY+i*96};});
  });
  return out;
 },[filtered]);

 const width=Math.max(760,...Object.values(positions).map(p=>p.x+200));
 const height=Math.max(430,...Object.values(positions).map(p=>p.y+115));
 const connectedIds=useMemo(()=>{
  const ids=new Set<string>(selected?[selected.id]:[]);
  filtered.edges.forEach(e=>{if(e.source===selected.id||e.target===selected.id){ids.add(e.source);ids.add(e.target);}});
  return ids;
 },[filtered.edges,selected]);

 function zoomBy(delta:number){setZoom(z=>Math.min(2,Math.max(.5,Number((z+delta).toFixed(2)))));}
 function fitGraph(){
  const available=canvasRef.current?.clientWidth;
  if(!available){setZoom(1);return;}
  setZoom(Math.min(1,Math.max(.5,Number(((available-30)/width).toFixed(2)))));
 }
 function onWheel(e:React.WheelEvent){
  if(e.ctrlKey||e.metaKey){e.preventDefault();zoomBy(e.deltaY<0?.1:-.1);}
 }
 function selectNode(n:GraphNode){setSelected(n);}

 return <div className="graph-layout">
  <div className="graph-canvas" ref={canvasRef} onWheel={onWheel}>
   <div className="graph-toolbar">
    <div className="graph-view-tabs">
     {(['all','path','evidence','tools'] as GraphView[]).map(v=><button key={v} className={view===v?'active':''} onClick={()=>setView(v)}>{v==='all'?'All':v==='path'?'Execution path':v==='evidence'?'Evidence':'Tools'}</button>)}
    </div>
    <div className="graph-zoom">
     <button onClick={()=>zoomBy(-.1)} aria-label="Zoom out" title="Zoom out">−</button>
     <span>{Math.round(zoom*100)}%</span>
     <button onClick={()=>zoomBy(.1)} aria-label="Zoom in" title="Zoom in">+</button>
     <button onClick={fitGraph} title="Fit graph">Fit</button>
     <button onClick={()=>setZoom(1)} title="Reset zoom">100%</button>
    </div>
   </div>
   <svg width={width*zoom} height={height*zoom} viewBox={'0 0 '+width+' '+height} role="img" aria-label="AI execution graph">
    <defs><marker id="reasonlens-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0,0 L8,4 L0,8 z" fill="#94a3b8"/></marker></defs>
    {filtered.edges.map(e=>{
     const a=positions[e.source],b=positions[e.target];if(!a||!b)return null;
     const related=connectedIds.has(e.source)&&connectedIds.has(e.target);
     const x1=a.x+170,y1=a.y+31,x2=b.x,y2=b.y+31,horizontal=Math.abs(y1-y2)<4;
     return <g key={e.id} opacity={selected&&(!related)?0.28:1}>
      {horizontal?<line x1={x1} y1={y1} x2={x2} y2={y2} stroke={related?'#64748b':'#cbd5e1'} strokeWidth={related?2.5:1.5} markerEnd="url(#reasonlens-arrow)"/>:<path d={'M '+x1+' '+y1+' C '+(x1+55)+' '+y1+', '+(x2-55)+' '+y2+', '+x2+' '+y2} fill="none" stroke={related?'#64748b':'#cbd5e1'} strokeWidth={related?2.5:1.5} markerEnd="url(#reasonlens-arrow)"/>}
      <text x={(x1+x2)/2} y={(y1+y2)/2-7} className="edge-label">{e.kind}</text>
     </g>;
    })}
    {filtered.nodes.map(n=>{
     const p=positions[n.id],active=selected.id===n.id,related=connectedIds.has(n.id);
     return <g key={n.id} transform={'translate('+p.x+','+p.y+')'} onClick={()=>selectNode(n)} className="node" opacity={selected && !related ? 0.45 : 1}>
      <rect width="170" height="62" rx="12" fill="white" stroke={active?colors[n.kind]:related?colors[n.kind]:'#cbd5e1'} strokeWidth={active?3:related?2:1.5}/>
      <rect width="6" height="62" rx="3" fill={colors[n.kind]||'#64748b'}/>
      <text x="18" y="24" className="node-kind">{n.kind}</text>
      <text x="18" y="45" className="node-label">{n.label.slice(0,25)}</text>
     </g>;
    })}
   </svg>
  </div>
  <aside className="inspector">
   <div className="eyebrow">SELECTED NODE</div><h3>{selected.label}</h3>
   <span className="pill" style={{borderColor:colors[selected.kind]}}>{selected.kind}</span>
   <p>{selected.detail||'No detail available.'}</p>
   {selected.metadata&&Object.keys(selected.metadata).length>0&&<dl>{Object.entries(selected.metadata).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{String(v)}</dd></div>)}</dl>}
  </aside>
 </div>;
}
