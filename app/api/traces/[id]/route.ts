import {NextResponse} from 'next/server';
import {getTrace} from '../../../../lib/trace-store';
import {constantTimeSecretEquals} from '../../../../lib/api-security';

function authorized(req:Request):boolean{
 return constantTimeSecretEquals(process.env.REASONLENS_INGEST_KEY,req.headers.get('authorization')?.replace(/^Bearer\s+/i,''));
}

export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 if(!authorized(req))return NextResponse.json({error:'Unauthorized'},{status:401});
 try{
  const {id}=await params;
  if(!id||id.length>100)return NextResponse.json({error:'Invalid trace ID'},{status:400});
  const trace=await getTrace(id);
  return trace?NextResponse.json(trace,{headers:{'Cache-Control':'no-store'}}):NextResponse.json({error:'Trace not found'},{status:404});
 }catch{
  return NextResponse.json({error:'Trace store unavailable'},{status:503});
 }
}
