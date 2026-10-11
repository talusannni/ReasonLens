-- Shared, atomic rate limits for server-side ReasonLens APIs.
create table if not exists public.reasonlens_rate_limit_buckets (
  bucket_key text primary key check (length(bucket_key) = 64),
  window_started_at timestamptz not null,
  request_count integer not null check (request_count >= 0),
  expires_at timestamptz not null
);
create index if not exists reasonlens_rate_limit_buckets_expiry_idx
  on public.reasonlens_rate_limit_buckets (expires_at);
alter table public.reasonlens_rate_limit_buckets enable row level security;
revoke all on public.reasonlens_rate_limit_buckets from public, anon, authenticated;

create or replace function public.reasonlens_consume_rate_limit(
  p_bucket_key text,
  p_limit integer,
  p_window_seconds integer
)
returns table(allowed boolean, remaining integer, reset_at timestamptz)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_started timestamptz;
  v_count integer;
begin
  if p_bucket_key is null or length(p_bucket_key) <> 64
     or p_limit < 1 or p_limit > 10000
     or p_window_seconds < 1 or p_window_seconds > 86400 then
    raise exception 'invalid rate limit arguments';
  end if;

  insert into public.reasonlens_rate_limit_buckets(bucket_key, window_started_at, request_count, expires_at)
  values (p_bucket_key, v_now, 1, v_now + make_interval(secs => p_window_seconds))
  on conflict (bucket_key) do update set
    window_started_at = case
      when public.reasonlens_rate_limit_buckets.window_started_at <= v_now - make_interval(secs => p_window_seconds)
      then v_now else public.reasonlens_rate_limit_buckets.window_started_at end,
    request_count = case
      when public.reasonlens_rate_limit_buckets.window_started_at <= v_now - make_interval(secs => p_window_seconds)
      then 1 else public.reasonlens_rate_limit_buckets.request_count + 1 end,
    expires_at = case
      when public.reasonlens_rate_limit_buckets.window_started_at <= v_now - make_interval(secs => p_window_seconds)
      then v_now + make_interval(secs => p_window_seconds)
      else public.reasonlens_rate_limit_buckets.expires_at end
  returning reasonlens_rate_limit_buckets.window_started_at, reasonlens_rate_limit_buckets.request_count
  into v_started, v_count;

  if mod(extract(epoch from v_now)::bigint, 100) = 0 then
    delete from public.reasonlens_rate_limit_buckets where expires_at < v_now;
  end if;

  return query select v_count <= p_limit, greatest(0, p_limit - v_count),
    v_started + make_interval(secs => p_window_seconds);
end;
$$;

revoke all on function public.reasonlens_consume_rate_limit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.reasonlens_consume_rate_limit(text, integer, integer) to service_role;
