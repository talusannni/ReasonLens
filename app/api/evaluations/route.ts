import {NextResponse} from 'next/server';
import {randomUUID} from 'crypto';
import {CORE_RAG_DATASET,evaluateDataset} from '../../../lib/evaluation';
import {saveEvaluationRun,listEvaluationRuns} from '../../../lib/evaluation-store';
import {getTrace,listTraces} from '../../../lib/trace-store';
import {dashboardAuthorized} from '../../../lib/dashboard-auth';

export async function GET(req:Request){
 if(!dashboardAuthorized(req))return NextResponse.json({error:'Dashboard authentication required'},{status:401});
 try{return NextResponse.json({runs:await listEvaluationRuns()},{headers:{'Cache-Control':'no-store'}});}
 catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Evaluation store unavailable'},{status:503});}
}
export async function POST(req:Request){
 if(!dashboardAuthorized(req))return NextResponse.json({error:'Dashboard authentication required'},{status:401});
 try{
  const body=await req.json();
  const name=typeof body?.name==='string'&&body.name.trim()?body.name.trim():'Evaluation run';
  const cases=Array.isArray(body?.cases)&&body.cases.length?body.cases:CORE_RAG_DATASET;
  const traces=await listTraces();
  const pinnedIds=Array.from(new Set((cases as Array<{traceId?:unknown}>).map(item=>typeof item?.traceId==='string'?item.traceId:undefined).filter((id):id is string=>!!id)));
  const pinned=await Promise.all(pinnedIds.map(id=>getTrace(id).catch(()=>undefined)));
  const traceMap=new Map([...traces,...pinned.filter((t):t is NonNullable<typeof t>=>!!t)].map(trace=>[trace.id,trace]));
  const run=evaluateDataset(name,cases,Array.from(traceMap.values()),undefined,randomUUID());
  await saveEvaluationRun(run);
  return NextResponse.json({run},{status:201});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Evaluation failed'},{status:500});}
}
