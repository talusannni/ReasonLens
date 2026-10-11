-- Shared, atomic rate limiting for horizontally scaled ReasonLens deployments.
create table if not exists public.reasonlens_rate_limit_windows (
  workspace_id uuid not null references public.reasonlens_workspaces(id) on delete cascade,
  bucket text not null check (length(bucket) between 1 and 80),
  window_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (workspace_id, bucket, window_start)
);

create index if not exists reasonlens_rate_limit_windows_window_idx
  on public.reasonlens_rate_limit_windows(window_start);

alter table public.reasonlens_rate_limit_windows enable row level security;
grant select, insert, update, delete on table public.reasonlens_rate_limit_windows to service_role;
create policy deny_direct_client_access on public.reasonlens_rate_limit_windows
  for all to anon, authenticated using (false) with check (false);

create or replace function public.reasonlens_consume_rate_limit(
  p_workspace_id uuid,
  p_bucket text,
  p_window_seconds integer,
  p_max_requests integer
)
returns table(allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_window_start timestamptz;
  v_count integer;
begin
  if p_workspace_id is null
    or p_bucket is null
    or length(p_bucket) < 1
    or length(p_bucket) > 80
    or p_window_seconds < 1
    or p_window_seconds > 86400
    or p_max_requests < 1
    or p_max_requests > 100000 then
    raise exception 'invalid rate limit parameters';
  end if;

  v_window_start := to_timestamp(
    floor(extract(epoch from clock_timestamp()) / p_window_seconds) * p_window_seconds
  );

  insert into public.reasonlens_rate_limit_windows(workspace_id, bucket, window_start, request_count)
  values (p_workspace_id, p_bucket, v_window_start, 1)
  on conflict (workspace_id, bucket, window_start)
  do update set request_count = public.reasonlens_rate_limit_windows.request_count + 1
  returning request_count into v_count;

  return query select
    v_count <= p_max_requests,
    greatest(0, p_max_requests - v_count),
    v_window_start + make_interval(secs => p_window_seconds);
end;
$$;

revoke all on function public.reasonlens_consume_rate_limit(uuid, text, integer, integer) from public, anon, authenticated;
grant execute on function public.reasonlens_consume_rate_limit(uuid, text, integer, integer) to service_role;

create or replace function public.reasonlens_delete_workspace(p_workspace_id uuid)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $
declare
  v_slug text;
  v_trace_count integer;
  v_evaluation_count integer;
  v_key_count integer;
  v_member_count integer;
  v_invitation_count integer;
begin
  select slug into v_slug
  from public.reasonlens_workspaces
  where id = p_workspace_id
  for update;

  if not found then
    raise exception 'workspace not found';
  end if;
  if v_slug = 'default' or p_workspace_id = '00000000-0000-4000-8000-000000000001'::uuid then
    raise exception 'default workspace cannot be deleted';
  end if;

  delete from public.reasonlens_evaluation_runs where workspace_id = p_workspace_id;
  get diagnostics v_evaluation_count = row_count;
  delete from public.reasonlens_traces where workspace_id = p_workspace_id;
  get diagnostics v_trace_count = row_count;
  delete from public.reasonlens_api_keys where workspace_id = p_workspace_id;
  get diagnostics v_key_count = row_count;
  delete from public.reasonlens_workspace_members where workspace_id = p_workspace_id;
  get diagnostics v_member_count = row_count;
  delete from public.reasonlens_workspace_invitations where workspace_id = p_workspace_id;
  get diagnostics v_invitation_count = row_count;
  delete from public.reasonlens_workspaces where id = p_workspace_id;

  return jsonb_build_object(
    'workspace_id', p_workspace_id,
    'traces_deleted', v_trace_count,
    'evaluation_runs_deleted', v_evaluation_count,
    'api_keys_deleted', v_key_count,
    'members_deleted', v_member_count,
    'invitations_deleted', v_invitation_count
  );
end;
$;

revoke all on function public.reasonlens_delete_workspace(uuid) from public, anon, authenticated;
grant execute on function public.reasonlens_delete_workspace(uuid) to service_role;

comment on table public.reasonlens_rate_limit_windows is
  'Atomic per-workspace counters. Expired windows are removed by the maintenance script.';

