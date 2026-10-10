import {NextResponse} from 'next/server';
import {createHash} from 'node:crypto';
import {constantTimeSecretEquals,readJsonBody} from '../../../../lib/api-security';

function fingerprint(value:string){return createHash('sha256').update(value).digest('hex');}

export async function POST(req:Request){
 const expected=process.env.REASONLENS_INGEST_KEY;
 if(!expected)return NextResponse.json({error:'Dashboard authentication is not configured'},{status:503});
 const parsed=await readJsonBody(req,16*1024);
 if(!parsed.ok)return NextResponse.json({error:parsed.error},{status:parsed.status});
 const body=parsed.value as Record<string,unknown>|null;
 if(!body||typeof body!=='object'||typeof body.key!=='string'||!constantTimeSecretEquals(expected,body.key)){
  return NextResponse.json({error:'Invalid dashboard key'},{status:401});
 }
 const response=NextResponse.json({ok:true});
 response.cookies.set('reasonlens_dashboard',fingerprint(expected),{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:60*60*24*7});
 return response;
}

export async function DELETE(){
 const response=NextResponse.json({ok:true});
 response.cookies.set('reasonlens_dashboard','',{httpOnly:true,secure:process.env.NODE_ENV==='production',sameSite:'strict',path:'/',maxAge:0});
 return response;
}
