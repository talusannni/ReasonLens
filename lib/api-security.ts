import {createHash,timingSafeEqual} from 'node:crypto';

export function constantTimeSecretEquals(expected:string|undefined,supplied:string|undefined):boolean{
 if(!expected||!supplied)return false;
 const expectedDigest=createHash('sha256').update(expected).digest();
 const suppliedDigest=createHash('sha256').update(supplied).digest();
 return timingSafeEqual(expectedDigest,suppliedDigest);
}

export type JsonBodyResult=
 |{ok:true;value:unknown}
 |{ok:false;status:400|413;error:string};

export async function readJsonBody(req:Request,maxBytes=1024*1024):Promise<JsonBodyResult>{
 const declaredLength=req.headers.get('content-length');
 if(declaredLength){
  const length=Number(declaredLength);
  if(Number.isFinite(length)&&length>maxBytes)return {ok:false,status:413,error:'Request body too large'};
 }
 if(!req.body)return {ok:false,status:400,error:'JSON body required'};
 const reader=req.body.getReader();
 const chunks:Uint8Array[]=[];
 let total=0;
 try{
  while(true){
   const {done,value}=await reader.read();
   if(done)break;
   total+=value.byteLength;
   if(total>maxBytes){
    await reader.cancel().catch(()=>undefined);
    return {ok:false,status:413,error:'Request body too large'};
   }
   chunks.push(value);
  }
 }catch{
  return {ok:false,status:400,error:'Could not read request body'};
 }
 const bytes=new Uint8Array(total);
 let offset=0;
 for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength;}
 try{
  return {ok:true,value:JSON.parse(new TextDecoder().decode(bytes)) as unknown};
 }catch{
  return {ok:false,status:400,error:'Invalid JSON body'};
 }
}
