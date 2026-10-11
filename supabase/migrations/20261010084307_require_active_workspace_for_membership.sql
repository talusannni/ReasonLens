-- Suspended workspaces must not pass membership-based RLS checks.
create or replace function private.reasonlens_is_workspace_member(target_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.reasonlens_workspace_members m
    join public.reasonlens_workspaces w on w.id = m.workspace_id
    where m.workspace_id = target_workspace_id
      and m.user_id = auth.uid()
      and w.status = 'active'
  );
$$;

create or replace function private.reasonlens_has_workspace_role(
  target_workspace_id uuid,
  allowed_roles text[]
)
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.reasonlens_workspace_members m
    join public.reasonlens_workspaces w on w.id = m.workspace_id
    where m.workspace_id = target_workspace_id
      and m.user_id = auth.uid()
      and m.role = any(allowed_roles)
      and w.status = 'active'
  );
$$;

revoke all on function private.reasonlens_is_workspace_member(uuid) from public, anon;
revoke all on function private.reasonlens_has_workspace_role(uuid, text[]) from public, anon;
grant execute on function private.reasonlens_is_workspace_member(uuid) to authenticated, service_role;
grant execute on function private.reasonlens_has_workspace_role(uuid, text[]) to authenticated, service_role;
