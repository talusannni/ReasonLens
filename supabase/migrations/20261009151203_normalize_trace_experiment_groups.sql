-- Variants from the same workflow must share one experiment identifier.
-- Existing workflows use workflow_id as the stable group key.
update public.reasonlens_traces
set experiment_id = workflow_id
where parent_trace_id is not null
  and workflow_id is not null
  and experiment_id is distinct from workflow_id;
