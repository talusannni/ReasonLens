-- Trace lineage: relate reruns and experiments without overwriting prior executions.
alter table public.reasonlens_traces
  add column if not exists workflow_id uuid,
  add column if not exists parent_trace_id uuid,
  add column if not exists experiment_id uuid,
  add column if not exists config_fingerprint text;

update public.reasonlens_traces
set workflow_id = id
where workflow_id is null;

alter table public.reasonlens_traces
  alter column workflow_id set not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'reasonlens_traces_parent_trace_id_fkey'
      and conrelid = 'public.reasonlens_traces'::regclass
  ) then
    alter table public.reasonlens_traces
      add constraint reasonlens_traces_parent_trace_id_fkey
      foreign key (parent_trace_id) references public.reasonlens_traces(id)
      on delete set null;
  end if;
end $$;

create index if not exists reasonlens_traces_workflow_id_created_at_idx
  on public.reasonlens_traces (workflow_id, created_at desc);
create index if not exists reasonlens_traces_parent_trace_id_idx
  on public.reasonlens_traces (parent_trace_id);
create index if not exists reasonlens_traces_experiment_id_idx
  on public.reasonlens_traces (experiment_id);
