import { NextResponse } from 'next/server';
import { consumeWorkspaceRateLimit } from './workspace-rate-limit';

export async function enforceWorkspaceRateLimit(
 workspaceId: string,
 bucket: string,
 windowSeconds: number,
 maxRequests: number
): Promise<NextResponse | null> {
 try {
  const result = await consumeWorkspaceRateLimit(workspaceId, bucket, windowSeconds, maxRequests);
  const resetSeconds = Math.max(1, Math.ceil((Date.parse(result.resetAt) - Date.now()) / 1000));
  const headers = {
   'Cache-Control': 'no-store',
   'X-RateLimit-Limit': String(maxRequests),
   'X-RateLimit-Remaining': String(result.remaining),
   'X-RateLimit-Reset': String(Math.ceil(Date.parse(result.resetAt) / 1000))
  };
  if (!result.allowed) {
   return NextResponse.json(
    { error: 'Rate limit exceeded', retryAfterSeconds: resetSeconds },
    { status: 429, headers: { ...headers, 'Retry-After': String(resetSeconds) } }
   );
  }
  return null;
 } catch {
  // Fail closed: never bypass abuse protection when the shared limiter is unavailable.
  return NextResponse.json(
   { error: 'Rate-limit service unavailable' },
   { status: 503, headers: { 'Cache-Control': 'no-store', 'Retry-After': '30' } }
  );
 }
}
