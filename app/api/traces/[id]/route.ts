import {NextResponse} from 'next/server';
import {getTrace} from '../../../../lib/trace-store';

export async function GET(_:Request,{params}:{params:Promise<{id:string}>}){
 const {id}=await params;
 const trace=getTrace(id);
 return trace?NextResponse.json(trace):NextResponse.json({error:'Trace not found'},{status:404});
}
