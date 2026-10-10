-- Keep SECURITY DEFINER membership helpers outside PostgREST's exposed public schema.
create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

create or replace function private.reasonlens_is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.reasonlens_workspace_members m
    where m.workspace_id = target_workspace_id and m.user_id = auth.uid()
  );
$$;

create or replace function private.reasonlens_has_workspace_role(target_workspace_id uuid, allowed_roles text[])
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.reasonlens_workspace_members m
    where m.workspace_id = target_workspace_id
      and m.user_id = auth.uid()
      and m.role = any(allowed_roles)
  );
$$;

revoke all on function private.reasonlens_is_workspace_member(uuid) from public, anon;
revoke all on function private.reasonlens_has_workspace_role(uuid, text[]) from public, anon;
grant execute on function private.reasonlens_is_workspace_member(uuid) to authenticated, service_role;
grant execute on function private.reasonlens_has_workspace_role(uuid, text[]) to authenticated, service_role;

drop policy if exists workspace_member_can_read_workspace on public.reasonlens_workspaces;
create policy workspace_member_can_read_workspace on public.reasonlens_workspaces
  for select to authenticated using (private.reasonlens_is_workspace_member(id));

drop policy if exists workspace_members_can_read_roster on public.reasonlens_workspace_members;
create policy workspace_members_can_read_roster on public.reasonlens_workspace_members
  for select to authenticated
  using (user_id = auth.uid() or private.reasonlens_is_workspace_member(workspace_id));

drop policy if exists workspace_member_can_read_traces on public.reasonlens_traces;
create policy workspace_member_can_read_traces on public.reasonlens_traces
  for select to authenticated using (private.reasonlens_is_workspace_member(workspace_id));
drop policy if exists workspace_member_can_insert_traces on public.reasonlens_traces;
create policy workspace_member_can_insert_traces on public.reasonlens_traces
  for insert to authenticated with check (private.reasonlens_is_workspace_member(workspace_id));
drop policy if exists workspace_member_can_update_traces on public.reasonlens_traces;
create policy workspace_member_can_update_traces on public.reasonlens_traces
  for update to authenticated using (private.reasonlens_is_workspace_member(workspace_id))
  with check (private.reasonlens_is_workspace_member(workspace_id));
drop policy if exists workspace_member_can_delete_traces on public.reasonlens_traces;
create policy workspace_member_can_delete_traces on public.reasonlens_traces
  for delete to authenticated using (private.reasonlens_is_workspace_member(workspace_id));

drop policy if exists workspace_member_can_read_evaluations on public.reasonlens_evaluation_runs;
create policy workspace_member_can_read_evaluations on public.reasonlens_evaluation_runs
  for select to authenticated using (private.reasonlens_is_workspace_member(workspace_id));
drop policy if exists workspace_member_can_insert_evaluations on public.reasonlens_evaluation_runs;
create policy workspace_member_can_insert_evaluations on public.reasonlens_evaluation_runs
  for insert to authenticated with check (private.reasonlens_is_workspace_member(workspace_id));
drop policy if exists workspace_member_can_update_evaluations on public.reasonlens_evaluation_runs;
create policy workspace_member_can_update_evaluations on public.reasonlens_evaluation_runs
  for update to authenticated using (private.reasonlens_is_workspace_member(workspace_id))
  with check (private.reasonlens_is_workspace_member(workspace_id));
drop policy if exists workspace_member_can_delete_evaluations on public.reasonlens_evaluation_runs;
create policy workspace_member_can_delete_evaluations on public.reasonlens_evaluation_runs
  for delete to authenticated using (private.reasonlens_is_workspace_member(workspace_id));

drop policy if exists workspace_admin_can_read_api_keys on public.reasonlens_api_keys;
create policy workspace_admin_can_read_api_keys on public.reasonlens_api_keys
  for select to authenticated using (private.reasonlens_has_workspace_role(workspace_id, array['owner','admin']));
drop policy if exists workspace_admin_can_insert_api_keys on public.reasonlens_api_keys;
create policy workspace_admin_can_insert_api_keys on public.reasonlens_api_keys
  for insert to authenticated with check (private.reasonlens_has_workspace_role(workspace_id, array['owner','admin']));
drop policy if exists workspace_admin_can_update_api_keys on public.reasonlens_api_keys;
create policy workspace_admin_can_update_api_keys on public.reasonlens_api_keys
  for update to authenticated using (private.reasonlens_has_workspace_role(workspace_id, array['owner','admin']))
  with check (private.reasonlens_has_workspace_role(workspace_id, array['owner','admin']));
drop policy if exists workspace_admin_can_delete_api_keys on public.reasonlens_api_keys;
create policy workspace_admin_can_delete_api_keys on public.reasonlens_api_keys
  for delete to authenticated using (private.reasonlens_has_workspace_role(workspace_id, array['owner','admin']));

drop policy if exists workspace_admin_can_read_invitations on public.reasonlens_workspace_invitations;
create policy workspace_admin_can_read_invitations on public.reasonlens_workspace_invitations
  for select to authenticated using (private.reasonlens_has_workspace_role(workspace_id, array['owner','admin']));

drop function if exists public.reasonlens_is_workspace_member(uuid);
drop function if exists public.reasonlens_has_workspace_role(uuid, text[]);
