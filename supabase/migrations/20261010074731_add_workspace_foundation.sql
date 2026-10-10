-- Add workspace boundaries without changing existing trace/evaluation behavior.
-- Existing rows and legacy ingestion credentials belong to the stable default workspace.
create table if not exists public.reasonlens_workspaces (
  id uuid primary key,
  name text not null,
  slug text not null unique,
  status text not null default 'active' check (status in ('active','suspended')),
  created_at timestamptz not null default now()
);

insert into public.reasonlens_workspaces (id, name, slug, status)
values ('00000000-0000-4000-8000-000000000001', 'Default workspace', 'default', 'active')
on conflict (id) do nothing;

create table if not exists public.reasonlens_api_keys (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.reasonlens_workspaces(id) on delete restrict,
  name text not null,
  key_hash text not null unique check (length(key_hash) = 64),
  created_at timestamptz not null default now(),
  last_used_at timestamptz,
  revoked_at timestamptz
);

create index if not exists reasonlens_api_keys_workspace_id_idx
  on public.reasonlens_api_keys (workspace_id);

alter table public.reasonlens_traces
  add column if not exists workspace_id uuid;

update public.reasonlens_traces
set workspace_id = '00000000-0000-4000-8000-000000000001'
where workspace_id is null;

alter table public.reasonlens_traces
  alter column workspace_id set default '00000000-0000-4000-8000-000000000001',
  alter column workspace_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'reasonlens_traces_workspace_id_fkey'
      and conrelid = 'public.reasonlens_traces'::regclass
  ) then
    alter table public.reasonlens_traces
      add constraint reasonlens_traces_workspace_id_fkey
      foreign key (workspace_id) references public.reasonlens_workspaces(id) on delete restrict;
  end if;
end $$;

create index if not exists reasonlens_traces_workspace_created_at_idx
  on public.reasonlens_traces (workspace_id, created_at desc);

alter table public.reasonlens_evaluation_runs
  add column if not exists workspace_id uuid;

update public.reasonlens_evaluation_runs
set workspace_id = '00000000-0000-4000-8000-000000000001'
where workspace_id is null;

alter table public.reasonlens_evaluation_runs
  alter column workspace_id set default '00000000-0000-4000-8000-000000000001',
  alter column workspace_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'reasonlens_evaluation_runs_workspace_id_fkey'
      and conrelid = 'public.reasonlens_evaluation_runs'::regclass
  ) then
    alter table public.reasonlens_evaluation_runs
      add constraint reasonlens_evaluation_runs_workspace_id_fkey
      foreign key (workspace_id) references public.reasonlens_workspaces(id) on delete restrict;
  end if;
end $$;

create index if not exists reasonlens_evaluation_runs_workspace_created_at_idx
  on public.reasonlens_evaluation_runs (workspace_id, created_at desc);

alter table public.reasonlens_workspaces enable row level security;
alter table public.reasonlens_api_keys enable row level security;
