import {createHash} from 'node:crypto';
import {NextResponse} from 'next/server';

type LimitResult = {allowed:boolean; remaining:number; reset_at:string};

export function rateLimitBucketKey(scope:string):string{
 return createHash('sha256').update(scope).digest('hex');
}

function clientAddress(req:Request):string{
 // These headers are populated by the hosting proxy. Hash the value before storage.
 const real=req.headers.get('x-real-ip')?.trim();
 if(real)return real.slice(0,128);
 const forwarded=req.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
 return forwarded?forwarded.slice(0,128):'unknown';
}

export async function enforceRateLimit(
 req:Request,
 scope:string,
 limit:number,
 windowSeconds=60
):Promise<NextResponse|null>{
 const url=process.env.SUPABASE_URL?.replace(/\/$/,'');
 const key=process.env.SUPABASE_SERVICE_ROLE_KEY;
 if(!url||!key){
  // Local development can run without a persistence backend. Hosted production must fail closed.
  return process.env.NODE_ENV==='production'
   ?NextResponse.json({error:'Rate limiting is temporarily unavailable'},{status:503,headers:{'Cache-Control':'no-store'}})
   :null;
 }
 const bucketKey=rateLimitBucketKey(scope);
 try{
  const response=await fetch(url+'/rest/v1/rpc/reasonlens_consume_rate_limit',{
   method:'POST',
   headers:{'Content-Type':'application/json',apikey:key,Authorization:'Bearer '+key},
   body:JSON.stringify({p_bucket_key:bucketKey,p_limit:limit,p_window_seconds:windowSeconds}),
   cache:'no-store'
  });
  if(!response.ok)throw new Error('Rate limit store unavailable');
  const data=await response.json() as LimitResult[]|LimitResult;
  const result=Array.isArray(data)?data[0]:data;
  if(!result||typeof result.allowed!=='boolean'||typeof result.remaining!=='number'||typeof result.reset_at!=='string')throw new Error('Invalid rate limit response');
  const resetEpoch=Math.ceil(Date.parse(result.reset_at)/1000);
  const headers={'Cache-Control':'no-store','RateLimit-Limit':String(limit),'RateLimit-Remaining':String(result.remaining),'RateLimit-Reset':String(resetEpoch)};
  if(!result.allowed){
   return NextResponse.json({error:'Rate limit exceeded; retry after the current window resets.'},{status:429,headers:{...headers,'Retry-After':String(Math.max(1,resetEpoch-Math.floor(Date.now()/1000)))}});
  }
  return null;
 }catch{
  return NextResponse.json({error:'Rate limiting is temporarily unavailable'},{status:503,headers:{'Cache-Control':'no-store'}});
 }
}

export function ipRateLimitScope(req:Request,route:string):string{
 return 'ip:'+clientAddress(req)+':'+route;
}

export function workspaceRateLimitScope(workspaceId:string,route:string):string{
 return 'workspace:'+workspaceId+':'+route;
}
