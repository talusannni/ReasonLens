-- Enforce trace lineage within a single workspace at the database boundary.
-- Repair any legacy cross-workspace parent pointers before adding the composite FK.
update public.reasonlens_traces child
set parent_trace_id = null
from public.reasonlens_traces parent
where child.parent_trace_id = parent.id
  and child.workspace_id <> parent.workspace_id;

-- PostgreSQL needs a unique key matching the composite FK target.
create unique index if not exists reasonlens_traces_workspace_id_id_uidx
  on public.reasonlens_traces (workspace_id, id);

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'reasonlens_traces_parent_same_workspace_fkey'
      and conrelid = 'public.reasonlens_traces'::regclass
  ) then
    alter table public.reasonlens_traces
      add constraint reasonlens_traces_parent_same_workspace_fkey
      foreign key (workspace_id, parent_trace_id)
      references public.reasonlens_traces (workspace_id, id)
      on delete set null (parent_trace_id);
  end if;
end $$;

create index if not exists reasonlens_traces_workspace_parent_idx
  on public.reasonlens_traces (workspace_id, parent_trace_id);
