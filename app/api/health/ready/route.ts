import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
 const url = process.env.SUPABASE_URL?.replace(/\/$/, '');
 const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
 if (!url || !key) {
  return NextResponse.json(
   { status: 'not_ready', service: 'reasonlens' },
   { status: 503, headers: { 'Cache-Control': 'no-store' } }
  );
 }
 try {
  const response = await fetch(url + '/rest/v1/reasonlens_workspaces?select=id&limit=1', {
   headers: { apikey: key, Authorization: 'Bearer ' + key },
   cache: 'no-store',
   signal: AbortSignal.timeout(3000)
  });
  if (!response.ok) throw new Error('Storage check failed');
  return NextResponse.json(
   { status: 'ready', service: 'reasonlens' },
   { headers: { 'Cache-Control': 'no-store' } }
  );
 } catch {
  return NextResponse.json(
   { status: 'not_ready', service: 'reasonlens' },
   { status: 503, headers: { 'Cache-Control': 'no-store' } }
  );
 }
}
