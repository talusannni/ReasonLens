-- ReasonLens uses server-side API routes with the Supabase service role for
-- application data access. Browser clients must not access these tables directly.
revoke all privileges on table
  public.reasonlens_api_keys,
  public.reasonlens_workspace_invitations,
  public.reasonlens_workspace_members,
  public.reasonlens_workspaces,
  public.reasonlens_traces,
  public.reasonlens_evaluation_runs
from anon, authenticated;

-- These permissive false policies do not deny access when another permissive
-- policy allows it. Remove the misleading policies; keep the positive
-- workspace-membership/admin policies as defense in depth.
drop policy if exists deny_direct_client_access on public.reasonlens_api_keys;
drop policy if exists deny_direct_client_access on public.reasonlens_evaluation_runs;
drop policy if exists deny_direct_client_access on public.reasonlens_traces;
drop policy if exists deny_direct_client_access on public.reasonlens_workspaces;
