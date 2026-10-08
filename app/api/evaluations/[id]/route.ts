import {NextResponse} from 'next/server';
import {getEvaluationRun} from '../../../../lib/evaluation-store';
import {dashboardAuthorized} from '../../../../lib/dashboard-auth';

export async function GET(req:Request,{params}:{params:{id:string}}){
 if(!dashboardAuthorized(req))return NextResponse.json({error:'Dashboard authentication required'},{status:401});
 try{
  const run=await getEvaluationRun(params.id);
  if(!run)return NextResponse.json({error:'Evaluation run not found'},{status:404});
  return NextResponse.json({run},{headers:{'Cache-Control':'no-store'}});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Evaluation unavailable'},{status:503});}
}
