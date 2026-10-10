-- ReasonLens team tenancy foundation. Existing trusted server routes continue using service_role.
create table if not exists public.reasonlens_workspace_members (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.reasonlens_workspaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','admin','member')),
  created_at timestamptz not null default now(),
  unique (workspace_id, user_id)
);

create index if not exists reasonlens_workspace_members_user_idx
  on public.reasonlens_workspace_members(user_id, workspace_id);
create index if not exists reasonlens_workspace_members_workspace_idx
  on public.reasonlens_workspace_members(workspace_id, role);

create table if not exists public.reasonlens_workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.reasonlens_workspaces(id) on delete cascade,
  email text not null check (length(trim(email)) between 3 and 320),
  role text not null default 'member' check (role in ('admin','member')),
  token_hash text not null unique check (length(token_hash) = 64),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  accepted_at timestamptz,
  revoked_at timestamptz
);

create index if not exists reasonlens_workspace_invitations_workspace_idx
  on public.reasonlens_workspace_invitations(workspace_id, created_at desc);
create index if not exists reasonlens_workspace_invitations_email_idx
  on public.reasonlens_workspace_invitations(lower(email));

create or replace function public.reasonlens_is_workspace_member(target_workspace_id uuid)
returns boolean language sql stable security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.reasonlens_workspace_members m
    where m.workspace_id = target_workspace_id and m.user_id = auth.uid()
  );
$$;

create or replace function public.reasonlens_has_workspace_role(target_workspace_id uuid, allowed_roles text[])
returns boolean language sql stable security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from public.reasonlens_workspace_members m
    where m.workspace_id = target_workspace_id
      and m.user_id = auth.uid()
      and m.role = any(allowed_roles)
  );
$$;

revoke all on function public.reasonlens_is_workspace_member(uuid) from public;
revoke all on function public.reasonlens_has_workspace_role(uuid, text[]) from public;
grant execute on function public.reasonlens_is_workspace_member(uuid) to authenticated, service_role;
grant execute on function public.reasonlens_has_workspace_role(uuid, text[]) to authenticated, service_role;

alter table public.reasonlens_workspace_members enable row level security;
alter table public.reasonlens_workspace_invitations enable row level security;

create policy workspace_member_can_read_workspace on public.reasonlens_workspaces
  for select to authenticated using (public.reasonlens_is_workspace_member(id));
create policy workspace_members_can_read_roster on public.reasonlens_workspace_members
  for select to authenticated
  using (user_id = auth.uid() or public.reasonlens_is_workspace_member(workspace_id));

-- Membership/invitation writes remain server-only until their APIs are implemented.
create policy workspace_member_can_read_traces on public.reasonlens_traces
  for select to authenticated using (public.reasonlens_is_workspace_member(workspace_id));
create policy workspace_member_can_insert_traces on public.reasonlens_traces
  for insert to authenticated with check (public.reasonlens_is_workspace_member(workspace_id));
create policy workspace_member_can_update_traces on public.reasonlens_traces
  for update to authenticated using (public.reasonlens_is_workspace_member(workspace_id))
  with check (public.reasonlens_is_workspace_member(workspace_id));
create policy workspace_member_can_delete_traces on public.reasonlens_traces
  for delete to authenticated using (public.reasonlens_is_workspace_member(workspace_id));

create policy workspace_member_can_read_evaluations on public.reasonlens_evaluation_runs
  for select to authenticated using (public.reasonlens_is_workspace_member(workspace_id));
create policy workspace_member_can_insert_evaluations on public.reasonlens_evaluation_runs
  for insert to authenticated with check (public.reasonlens_is_workspace_member(workspace_id));
create policy workspace_member_can_update_evaluations on public.reasonlens_evaluation_runs
  for update to authenticated using (public.reasonlens_is_workspace_member(workspace_id))
  with check (public.reasonlens_is_workspace_member(workspace_id));
create policy workspace_member_can_delete_evaluations on public.reasonlens_evaluation_runs
  for delete to authenticated using (public.reasonlens_is_workspace_member(workspace_id));

create policy workspace_admin_can_read_api_keys on public.reasonlens_api_keys
  for select to authenticated using (public.reasonlens_has_workspace_role(workspace_id, array['owner','admin']));
create policy workspace_admin_can_insert_api_keys on public.reasonlens_api_keys
  for insert to authenticated with check (public.reasonlens_has_workspace_role(workspace_id, array['owner','admin']));
create policy workspace_admin_can_update_api_keys on public.reasonlens_api_keys
  for update to authenticated using (public.reasonlens_has_workspace_role(workspace_id, array['owner','admin']))
  with check (public.reasonlens_has_workspace_role(workspace_id, array['owner','admin']));
create policy workspace_admin_can_delete_api_keys on public.reasonlens_api_keys
  for delete to authenticated using (public.reasonlens_has_workspace_role(workspace_id, array['owner','admin']));

create policy workspace_admin_can_read_invitations on public.reasonlens_workspace_invitations
  for select to authenticated using (public.reasonlens_has_workspace_role(workspace_id, array['owner','admin']));
