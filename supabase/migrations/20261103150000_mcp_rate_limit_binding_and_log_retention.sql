-- MCP scaling follow-up (docs/MCP.md, ADR 0034).
--
-- 1. Rate limiting moved to the Cloudflare Rate Limiting binding in
--    workers/mcp. The per-request claim_mcp_rate_limit RPC (advisory lock +
--    count over mcp_action_log) is no longer called; drop it.
-- 2. mcp_action_log is an audit trail, not a permanent record. Keep 30 days,
--    pruned nightly by pg_cron.

drop function if exists public.claim_mcp_rate_limit(integer, integer);

-- Retention deletes scan by created_at alone; the existing
-- (user_id, created_at) index cannot serve that predicate.
create index if not exists mcp_action_log_created_idx
  on public.mcp_action_log (created_at);

create extension if not exists pg_cron with schema pg_catalog;

-- Idempotent: re-running the migration (db reset, branches) replaces the job.
select cron.unschedule(jobid)
from cron.job
where jobname = 'mcp-action-log-retention';

select cron.schedule(
  'mcp-action-log-retention',
  '17 3 * * *',
  $$delete from public.mcp_action_log where created_at < now() - interval '30 days'$$
);
