import {NextResponse} from 'next/server';
import {getTrace} from '../../../../lib/trace-store';

function authorized(req:Request):boolean{
 const expected=process.env.REASONLENS_INGEST_KEY;
 if(!expected)return false;
 const supplied=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'');
 return supplied===expected;
}

export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 try{
  if(!authorized(req))return NextResponse.json({error:'Unauthorized'},{status:401});
  const {id}=await params;
  const trace=await getTrace(id);
  return trace?NextResponse.json(trace):NextResponse.json({error:'Trace not found'},{status:404});
 }catch(e){return NextResponse.json({error:e instanceof Error?e.message:'Persistence error'},{status:503});}
}
