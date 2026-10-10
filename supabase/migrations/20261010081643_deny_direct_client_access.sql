-- ReasonLens persistence currently uses trusted server-side routes with the service-role key.
-- Deny direct anon/authenticated access until membership-based RLS policies are implemented.
-- Do not FORCE ROW LEVEL SECURITY: trusted server routes must continue to work.
create policy deny_direct_client_access on public.reasonlens_workspaces
  for all to anon, authenticated using (false) with check (false);
create policy deny_direct_client_access on public.reasonlens_api_keys
  for all to anon, authenticated using (false) with check (false);
create policy deny_direct_client_access on public.reasonlens_traces
  for all to anon, authenticated using (false) with check (false);
create policy deny_direct_client_access on public.reasonlens_evaluation_runs
  for all to anon, authenticated using (false) with check (false);

comment on policy deny_direct_client_access on public.reasonlens_workspaces is
  'Default-deny direct browser roles until membership-based RLS policies are implemented.';
comment on policy deny_direct_client_access on public.reasonlens_api_keys is
  'API key hashes and metadata are accessible only through trusted server routes.';
comment on policy deny_direct_client_access on public.reasonlens_traces is
  'Trace data is accessed through server routes that enforce workspace scoping.';
comment on policy deny_direct_client_access on public.reasonlens_evaluation_runs is
  'Evaluation data is accessed through server routes that enforce workspace scoping.';
