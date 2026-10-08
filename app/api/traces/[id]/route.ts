import {NextResponse} from 'next/server';
import {getTrace} from '../../../../lib/trace-store';

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
 try{
  const {id}=await params;
  const trace=await getTrace(id);
  return trace?NextResponse.json(trace):NextResponse.json({error:'Trace not found'},{status:404});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Persistence error'},{status:503});}
}
