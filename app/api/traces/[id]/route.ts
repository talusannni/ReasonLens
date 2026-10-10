import {NextResponse} from 'next/server';
import {getTrace} from '../../../../lib/trace-store';
import {resolveWorkspaceForCredential} from '../../../../lib/workspace-auth';

async function authorized(req:Request):Promise<string|null>{
 const credential=req.headers.get('authorization')?.replace(/^Bearer\s+/i,'').trim();
 return resolveWorkspaceForCredential(credential);
}

export async function GET(req:Request,{params}:{params:Promise<{id:string}>}){
 const workspaceId=await authorized(req);
 if(!workspaceId)return NextResponse.json({error:'Unauthorized'},{status:401});
 try{
  const {id}=await params;
  if(!id||id.length>100)return NextResponse.json({error:'Invalid trace ID'},{status:400});
  const trace=await getTrace(id,workspaceId);
  return trace?NextResponse.json(trace,{headers:{'Cache-Control':'no-store'}}):NextResponse.json({error:'Trace not found'},{status:404});
 }catch{
  return NextResponse.json({error:'Trace store unavailable'},{status:503});
 }
}
