export interface WorkspaceRateLimit {
 allowed: boolean;
 remaining: number;
 resetAt: string;
}

function config() {
 const url = process.env.SUPABASE_URL;
 const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
 if (!url || !key) throw new Error('Workspace rate limiting is not configured.');
 return { url: url.replace(/\/$/, ''), key };
}

/**
 * Uses a Postgres RPC so counters remain atomic across serverless instances.
 * The caller must map infrastructure failures to 503 rather than bypassing limits.
 */
export async function consumeWorkspaceRateLimit(
 workspaceId: string,
 bucket: string,
 windowSeconds: number,
 maxRequests: number
): Promise<WorkspaceRateLimit> {
 const { url, key } = config();
 const response = await fetch(url + '/rest/v1/rpc/reasonlens_consume_rate_limit', {
  method: 'POST',
  headers: {
   'Content-Type': 'application/json',
   apikey: key,
   Authorization: 'Bearer ' + key,
   'Cache-Control': 'no-store'
  },
  body: JSON.stringify({
   p_workspace_id: workspaceId,
   p_bucket: bucket,
   p_window_seconds: windowSeconds,
   p_max_requests: maxRequests
  }),
  cache: 'no-store'
 });
 if (!response.ok) throw new Error('Workspace rate-limit store unavailable.');
 const payload = await response.json();
 const row = Array.isArray(payload) ? payload[0] : payload;
 if (!row || typeof row.allowed !== 'boolean' || !Number.isFinite(row.remaining) ||
     typeof row.reset_at !== 'string' || !Number.isFinite(Date.parse(row.reset_at))) {
  throw new Error('Workspace rate-limit response invalid.');
 }
 return { allowed: row.allowed, remaining: row.remaining, resetAt: row.reset_at };
}
