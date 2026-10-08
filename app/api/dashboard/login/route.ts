import { NextResponse } from 'next/server';
import { createHash } from 'crypto';

function fingerprint(value:string){return createHash('sha256').update(value).digest('hex');}

export async function POST(req:Request){
  const expected=process.env.REASONLENS_INGEST_KEY;
  if(!expected)return NextResponse.json({error:'Dashboard authentication is not configured'},{status:503});
  try{
    const body=await req.json();
    if(typeof body.key!=='string'||body.key!==expected)return NextResponse.json({error:'Invalid dashboard key'},{status:401});
    const response=NextResponse.json({ok:true});
    response.cookies.set('reasonlens_dashboard',fingerprint(expected),{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:60*60*24*7});
    return response;
  }catch{return NextResponse.json({error:'Invalid request'},{status:400});}
}

export async function DELETE(){
  const response=NextResponse.json({ok:true});
  response.cookies.set('reasonlens_dashboard','',{httpOnly:true,secure:true,sameSite:'strict',path:'/',maxAge:0});
  return response;
}
