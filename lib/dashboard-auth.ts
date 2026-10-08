import {createHash,timingSafeEqual} from 'crypto';

export function dashboardAuthorized(req:Request):boolean{
 const expected=process.env.REASONLENS_INGEST_KEY;
 const supplied=req.headers.get('cookie')?.match(/(?:^|; )reasonlens_dashboard=([^;]+)/)?.[1];
 if(!expected||!supplied)return false;
 const a=Buffer.from(supplied);
 const b=Buffer.from(createHash('sha256').update(expected).digest('hex'));
 return a.length===b.length&&timingSafeEqual(a,b);
}
