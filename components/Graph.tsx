'use client';
import {useMemo,useState} from 'react';
import type {Trace,GraphNode} from '../lib/types';

const colors:Record<string,string>={
 prompt:'#7c3aed',analysis:'#2563eb',evidence:'#059669',claim:'#d97706',
 decision:'#dc2626',answer:'#111827',retrieval:'#0891b2',tool:'#9333ea',
 model:'#475569',warning:'#b91c1c'
};

export default function Graph({trace}:{trace:Trace}){
 const [selected,setSelected]=useState<GraphNode>(trace.nodes[0]);
 const positions=useMemo(()=>{
  const levels:Record<string,number>={};
  const incoming=new Set(trace.edges.map(e=>e.target));
  const q:Array<[string,number]>=trace.nodes.filter(n=>!incoming.has(n.id)).map(n=>[n.id,0]);

  while(q.length){
   const [id,l]=q.shift()!;
   if(levels[id]!==undefined&&levels[id]<=l)continue;
   levels[id]=l;
   trace.edges
    .filter(e=>e.source===id&&trace.nodes.some(n=>n.id===e.target))
    .forEach(e=>q.push([e.target,l+1]));
  }

  trace.nodes.forEach(n=>{if(levels[n.id]===undefined)levels[n.id]=0});

  const grouped:Record<number,GraphNode[]>={};
  trace.nodes.forEach(n=>(grouped[levels[n.id]]??=[]).push(n));

  const out:Record<string,{x:number,y:number}>={};
  Object.entries(grouped).forEach(([level,nodes])=>{
   const columnHeight=(nodes.length-1)*96;
   const startY=Math.max(70,270-columnHeight/2);
   nodes.forEach((n,i)=>{
    out[n.id]={x:70+Number(level)*235,y:startY+i*96};
   });
  });
  return out;
 },[trace]);

 const width=Math.max(760,...Object.values(positions).map(p=>p.x+200));
 const height=Math.max(430,...Object.values(positions).map(p=>p.y+115));

 return <div className="graph-layout">
  <div className="graph-canvas">
   <svg width={width} height={height} viewBox={'0 0 '+width+' '+height} role="img" aria-label="AI reasoning graph">
    <defs>
     <marker id="reasonlens-arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto">
      <path d="M0,0 L8,4 L0,8 z" fill="#94a3b8"/>
     </marker>
    </defs>

    {trace.edges.map(e=>{
     const a=positions[e.source],b=positions[e.target];
     if(!a||!b)return null;
     const x1=a.x+170;
     const y1=a.y+31;
     const x2=b.x;
     const y2=b.y+31;
     const horizontal=Math.abs(y1-y2)<4;
     return <g key={e.id}>
      {horizontal
       ? <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#cbd5e1" strokeWidth="2" markerEnd="url(#reasonlens-arrow)"/>
       : <path d={'M '+x1+' '+y1+' C '+(x1+55)+' '+y1+', '+(x2-55)+' '+y2+', '+x2+' '+y2} fill="none" stroke="#cbd5e1" strokeWidth="2" markerEnd="url(#reasonlens-arrow)"/>
      }
      <text x={(x1+x2)/2} y={(y1+y2)/2-7} className="edge-label">{e.kind}</text>
     </g>;
    })}

    {trace.nodes.map(n=>{
     const p=positions[n.id];
     const active=selected.id===n.id;
     return <g key={n.id} transform={'translate('+p.x+','+p.y+')'} onClick={()=>setSelected(n)} className="node">
      <rect width="170" height="62" rx="12" fill="white" stroke={active?colors[n.kind]:'#cbd5e1'} strokeWidth={active?3:1.5}/>
      <rect width="6" height="62" rx="3" fill={colors[n.kind]||'#64748b'}/>
      <text x="18" y="24" className="node-kind">{n.kind}</text>
      <text x="18" y="45" className="node-label">{n.label.slice(0,25)}</text>
     </g>;
    })}
   </svg>
  </div>

  <aside className="inspector">
   <div className="eyebrow">SELECTED NODE</div>
   <h3>{selected.label}</h3>
   <span className="pill" style={{borderColor:colors[selected.kind]}}>{selected.kind}</span>
   <p>{selected.detail||'No detail available.'}</p>
   {selected.metadata&&Object.keys(selected.metadata).length>0&&
    <dl>{Object.entries(selected.metadata).map(([k,v])=><div key={k}><dt>{k}</dt><dd>{String(v)}</dd></div>)}</dl>
   }
  </aside>
 </div>;
}
