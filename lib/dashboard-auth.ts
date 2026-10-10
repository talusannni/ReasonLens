import {createHash,createHmac,timingSafeEqual} from 'node:crypto';
import {DEFAULT_WORKSPACE_ID} from './workspace-auth';

const SESSION_TTL_SECONDS=60*60*24*7;

function sessionSecret(){return process.env.REASONLENS_SESSION_SECRET||process.env.REASONLENS_INGEST_KEY||process.env.SUPABASE_SERVICE_ROLE_KEY||'';}
function sign(value:string){
 const secret=sessionSecret();
 return secret?createHmac('sha256',secret).update(value).digest('hex'):'';
}
function safeEquals(a:string,b:string){
 const left=Buffer.from(a);const right=Buffer.from(b);
 return left.length===right.length&&timingSafeEqual(left,right);
}

export function createDashboardSession(workspaceId:string,ttlSeconds=SESSION_TTL_SECONDS):string{
 const expiresAt=Math.floor(Date.now()/1000)+ttlSeconds;
 const payload=workspaceId+'.'+expiresAt;
 const signature=sign(payload);
 if(!signature)throw new Error('Dashboard session signing is not configured.');
 return payload+'.'+signature;
}

export function dashboardWorkspaceId(req:Request):string|null{
 const supplied=req.headers.get('cookie')?.match(/(?:^|; )reasonlens_dashboard=([^;]+)/)?.[1];
 if(!supplied)return null;
 if(supplied.includes('.')){
  const parts=supplied.split('.');
  if(parts.length!==3)return null;
  const [workspaceId,expiresText,signature]=parts;
  if(!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(workspaceId))return null;
  if(!/^\d{10}$/.test(expiresText))return null;
  const expiresAt=Number(expiresText);
  if(!Number.isSafeInteger(expiresAt)||expiresAt<=Math.floor(Date.now()/1000))return null;
  const expected=sign(workspaceId+'.'+expiresText);
  return expected&&safeEquals(signature,expected)?workspaceId:null;
 }
 // Legacy sessions are restricted to the default workspace and naturally expire in the browser.
 const legacySecret=process.env.REASONLENS_INGEST_KEY;
 if(!legacySecret)return null;
 const legacySignature=createHash('sha256').update(legacySecret).digest('hex');
 return safeEquals(supplied,legacySignature)?DEFAULT_WORKSPACE_ID:null;
}

export function dashboardAuthorized(req:Request):boolean{
 return dashboardWorkspaceId(req)!==null;
}
