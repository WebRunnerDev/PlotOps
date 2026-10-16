-- Edge Function rate limiting shared across isolates (#279).
--
-- In-memory limiters only see one Edge isolate; this sliding-window log lives
-- in Postgres so every instance counts the same hits. Only the service role
-- (Edge Functions) may call consume_edge_rate_limit; the table is not exposed
-- to the Data API at all.

create table if not exists public.edge_rate_limit_hits (
  id bigint generated always as identity primary key,
  bucket text not null,
  hit_at timestamptz not null default now()
);

create index if not exists edge_rate_limit_hits_bucket_hit_at_idx
  on public.edge_rate_limit_hits (bucket, hit_at);

alter table public.edge_rate_limit_hits enable row level security;

revoke all on table public.edge_rate_limit_hits from public, anon, authenticated;

-- Records one hit for p_bucket unless the window is full.
-- Returns allowed + seconds until the oldest hit leaves the window.
create or replace function public.consume_edge_rate_limit(
  p_bucket text,
  p_limit integer,
  p_window_seconds integer
)
returns table (allowed boolean, retry_after_sec integer)
language plpgsql
security definer
set search_path = ''
as $$
declare
  window_length interval;
  hit_count integer;
  oldest_hit timestamptz;
begin
  if p_bucket is null
    or length(p_bucket) = 0
    or length(p_bucket) > 200
    or p_limit is null or p_limit < 1
    or p_window_seconds is null or p_window_seconds < 1 or p_window_seconds > 86400
  then
    raise exception 'invalid rate limit arguments' using errcode = '22023';
  end if;

  window_length := make_interval(secs => p_window_seconds);

  -- Serialize concurrent hits on the same bucket.
  perform pg_advisory_xact_lock(hashtextextended('edge_rate_limit:' || p_bucket, 0));

  delete from public.edge_rate_limit_hits h
  where h.bucket = p_bucket
    and h.hit_at <= now() - window_length;

  -- Occasionally sweep buckets that stopped receiving traffic (windows <= 1 day).
  if random() < 0.01 then
    delete from public.edge_rate_limit_hits h
    where h.hit_at < now() - interval '1 day';
  end if;

  select count(*), min(h.hit_at)
  into hit_count, oldest_hit
  from public.edge_rate_limit_hits h
  where h.bucket = p_bucket;

  if hit_count >= p_limit then
    return query select
      false,
      greatest(1, ceil(extract(epoch from (oldest_hit + window_length - now()))))::integer;
    return;
  end if;

  insert into public.edge_rate_limit_hits (bucket) values (p_bucket);
  return query select true, 0;
end;
$$;

revoke all on function public.consume_edge_rate_limit(text, integer, integer)
  from public, anon, authenticated;
grant execute on function public.consume_edge_rate_limit(text, integer, integer)
  to service_role;
