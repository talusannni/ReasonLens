import {NextResponse} from 'next/server';
import {randomUUID} from 'crypto';
import {CORE_RAG_DATASET,evaluateDataset} from '../../../lib/evaluation';
import {saveEvaluationRun,listEvaluationRuns} from '../../../lib/evaluation-store';
import {getTrace,listTraces} from '../../../lib/trace-store';
import {resolveDashboardWorkspaceId} from '../../../lib/dashboard-auth';
import {readJsonBody} from '../../../lib/api-security';
import type {Trace} from '../../../lib/types';

export async function GET(req:Request){
 const workspaceId=await resolveDashboardWorkspaceId(req);
 if(!workspaceId)return NextResponse.json({error:'Dashboard authentication required'},{status:401});
 try{return NextResponse.json({runs:await listEvaluationRuns(workspaceId)},{headers:{'Cache-Control':'no-store'}});}
 catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Evaluation store unavailable'},{status:503});}
}
export async function POST(req:Request){
 const workspaceId=await resolveDashboardWorkspaceId(req);
 if(!workspaceId)return NextResponse.json({error:'Dashboard authentication required'},{status:401});
 const parsed=await readJsonBody(req,256*1024);
 if(!parsed.ok)return NextResponse.json({error:parsed.error},{status:parsed.status});
 try{
  const body=parsed.value as Record<string,unknown>|null;
  if(!body||typeof body!=='object')return NextResponse.json({error:'Invalid evaluation payload'},{status:400});
  if(body.name!==undefined&&(typeof body.name!=='string'||body.name.trim().length>200))return NextResponse.json({error:'name must be a string of at most 200 characters'},{status:400});
  if(body.cases!==undefined&&(!Array.isArray(body.cases)||body.cases.length>500))return NextResponse.json({error:'cases must be an array with at most 500 entries'},{status:400});
  const cases=Array.isArray(body.cases)&&body.cases.length?body.cases:CORE_RAG_DATASET;
  for(const item of cases){
   if(!item||typeof item!=='object'||typeof item.id!=='string'||!item.id.trim()||item.id.length>120||
    typeof item.name!=='string'||!item.name.trim()||item.name.length>200||
    typeof item.prompt!=='string'||!item.prompt.trim()||item.prompt.length>12000||
    (item.traceId!==undefined&&(typeof item.traceId!=='string'||item.traceId.length>100))||
    (item.description!==undefined&&(typeof item.description!=='string'||item.description.length>2000))||
    (item.tags!==undefined&&(!Array.isArray(item.tags)||item.tags.length>20||item.tags.some((tag:unknown)=>typeof tag!=='string'||tag.length>100)))){
    return NextResponse.json({error:'Invalid evaluation case; check id, name, prompt, traceId, description, and tags limits'},{status:400});
   }
  }
  const name=typeof body.name==='string'&&body.name.trim()?body.name.trim():'Evaluation run';
  const traces=await listTraces(workspaceId);
  const pinnedIds=Array.from(new Set((cases as Array<{traceId?:unknown}>).map(item=>typeof item?.traceId==='string'?item.traceId:undefined).filter((id):id is string=>!!id)));
  const pinned=await Promise.all(pinnedIds.map(id=>getTrace(id,workspaceId).catch(()=>undefined)));
  const allTraces=[...traces,...pinned.filter((t):t is Trace=>!!t)];
  const traceMap=new Map<string,Trace>(allTraces.map(trace=>[trace.id,trace] as const));
  const run=evaluateDataset(name,cases,Array.from(traceMap.values()),undefined,randomUUID());
  await saveEvaluationRun(run,workspaceId);
  return NextResponse.json({run},{status:201});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Evaluation failed'},{status:500});}
}
