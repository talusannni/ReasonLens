import {NextResponse} from 'next/server';
import {randomUUID} from 'crypto';
import {CORE_RAG_DATASET,evaluateDataset} from '../../../lib/evaluation';
import {saveEvaluationRun,listEvaluationRuns} from '../../../lib/evaluation-store';
import {listTraces} from '../../../lib/trace-store';
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
  const run=evaluateDataset(name,cases,traces,undefined,randomUUID());
  await saveEvaluationRun(run);
  return NextResponse.json({run},{status:201});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Evaluation failed'},{status:500});}
}
