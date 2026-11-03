# Remote MCP server with Supabase OAuth 2.1

An MCP client should use PlotOps the way a Jira connector uses Jira: as the signed-in user, with that user's permissions, without a second credential store.

## Decision

- **Cloudflare Worker** is the MCP resource server (Streamable HTTP, JSON-RPC, RFC 9728 protected-resource metadata). Free-tier Workers; in-memory + Postgres sliding-window limits; no Durable Objects.
- **Supabase Auth OAuth 2.1** is the authorization server (`[auth.oauth_server]`, PKCE, dynamic client registration when enabled). The PlotOps SPA implements `/oauth/consent`.
- The Worker calls PostgREST / RPCs with the **publishable key + user access token**. The **service role key is never used**.
- Task writes shared with the SPA: `create_task` (position, default type, auto-assign, `author_id = auth.uid()`), `update_task_details` (MCP omits author and git/PR fields), `change_task_status` → `persist_task_moves`, `add_task_comment`.
- v1 tools: `whoami`, `list_projects`, `list_boards`, `list_tasks`, `get_task`, `create_task`, `update_task`, `change_status`, `add_comment`. No delete, team admin, or PR merge.
- Verify tokens with `auth.getClaims(jwt)`: local ES256 verification against the cached JWKS (the hosted project signs with ES256), with supabase-js falling back to `getUser` for HS256. Accepted trade-off: no per-request revocation check, same as PostgREST.
- Rate limit with Cloudflare Rate Limiting bindings, not a database claim per request. Retain `mcp_action_log` for 30 days (pg_cron).

## Rejected

- **Personal API tokens as the first design.** Owner chose OAuth 2.1. Tokens remain the fallback if hosted Auth cannot enable the OAuth server (see `docs/MCP.md`).
- **Service-role Worker that impersonates the user.** Bypasses RLS and is a single secret away from full database access.
- **`@modelcontextprotocol/sdk` on the Worker.** A small JSON-RPC handler is enough for Streamable HTTP initialize / tools / call and keeps the bundle small.
- **Dropping `author_id` from `update_task_details`.** The SPA still transfers Author. MCP simply does not pass that field; system columns are locked with a trigger + column `GRANT UPDATE`.
