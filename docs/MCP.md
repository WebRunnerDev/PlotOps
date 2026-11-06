# PlotOps MCP server

Remote [Model Context Protocol](https://modelcontextprotocol.io) server so an MCP client (for example Grok Bot) can work with PlotOps the way a Jira MCP connector works with Jira: list Projects / Boards / Tasks, read a Task with comments, create and update Tasks, move status, and add comments — **as the signed-in user**, with existing RLS.

v1 does **not** delete Tasks, manage Teams, or merge pull requests.

## Architecture

```
MCP client  --OAuth 2.1 (PKCE)-->  Supabase Auth (authorization server)
     |                                      |
     | Bearer access token                  | /oauth/consent in the PlotOps SPA
     v                                      v
Cloudflare Worker  --publishable key + user JWT-->  PostgREST / RPCs (RLS)
  Streamable HTTP /mcp
```

- **Resource server:** `workers/mcp` (Cloudflare Worker, Streamable HTTP JSON-RPC, MCP protocol `2025-06-18`).
- **Authorization server:** Supabase Auth OAuth 2.1 (`{VITE_SUPABASE_URL}/auth/v1`). Dynamic client registration is enabled locally in `supabase/config.toml`.
- **Consent UI:** PlotOps route `/oauth/consent` (`authorization_url_path`). Guests cannot grant access.
- **Data plane:** the Worker calls Supabase with the **publishable key** and the user's **access token**. The service role key is never used. Task writes go through `create_task`, `update_task_details`, `change_task_status`, and `add_task_comment` so the SPA and MCP share the same rules.

Protected-resource metadata (RFC 9728) is served at:

- `/.well-known/oauth-protected-resource`
- aliases under `/mcp` for clients that probe path-prefixed well-known URLs

Unauthenticated `/mcp` requests return `401` with `WWW-Authenticate: Bearer … resource_metadata=…`.

## Tools

| Tool            | Notes                                                                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `whoami`        | Signed-in user id, email, OAuth `client_id`                                                                                                                                                                        |
| `list_projects` | Projects the JWT can view                                                                                                                                                                                          |
| `list_boards`   | Boards in a Project, including columns (`id`, `name`, `is_done`)                                                                                                                                                   |
| `list_tasks`    | Filters: `project_id` / `board_id`, `status` (column id), `assignee_id` (`me` / `unassigned` / UUID), `q`                                                                                                          |
| `get_task`      | Task + comments + labels (`task_id` or `task_key`); `task.git_links[]` — one per Repository: `repository_id`, `repository { github_full_name, github_html_url }`, `branch_name`, `pr_number`, `pr_state`, `pr_url` |
| `create_task`   | RPC: position, default type, auto-assign, `author_id = auth.uid()`; returns the task like `get_task`                                                                                                               |
| `update_task`   | Whitelisted fields via `update_task_details` (no author / git / PR)                                                                                                                                                |
| `change_status` | Move to a column via `persist_task_moves` (Done-column gates apply)                                                                                                                                                |
| `add_comment`   | Optional `parent_id` reply; author is the caller                                                                                                                                                                   |

## What you must configure (hosted)

`config.toml` only affects **local Docker**. The hosted PlotOps project must be turned on in the Supabase dashboard.

### 1. Enable the Auth OAuth 2.1 server

Dashboard → **Authentication** → **OAuth Server** (or Auth settings for OAuth 2.1):

1. Enable the OAuth server.
2. Set the authorization / consent path to `/oauth/consent` (PlotOps origin, e.g. `https://plotops.webrunner.dev/oauth/consent`).
3. Enable **dynamic client registration** if you want MCP clients to register themselves (recommended for Grok Bot / generic MCP).
4. Confirm **Site URL** is the production origin (`https://plotops.webrunner.dev`).
5. Add Redirect URLs that cover the SPA:
    - `https://plotops.webrunner.dev/**`
    - `https://plotops.webrunner.dev/oauth/consent`
    - existing GitHub/Google callbacks unchanged

If the OAuth Server toggle is **missing on this plan**, stop — do not invent another authorization path in this repo. The fallback is personal API tokens (see [Fallback](#fallback-if-the-oauth-server-cannot-be-enabled)).

### 2. Deploy the Worker

From the repo root (Cloudflare account on the free Workers tier is enough):

```bash
# one-time: copy example and fill local values
cp workers/mcp/.dev.vars.example workers/mcp/.dev.vars

npx wrangler login
npx wrangler secret put SUPABASE_URL --config workers/mcp/wrangler.toml
# value: https://ijcelrdcygzyzhcijkhe.supabase.co  (PlotOps only — not another ref)

npx wrangler secret put SUPABASE_PUBLISHABLE_KEY --config workers/mcp/wrangler.toml
# the same publishable / anon key as VITE_SUPABASE_PUBLISHABLE_KEY
# never the service_role key

npm run mcp:deploy
```

Optional public override (custom domain or stable `workers.dev` URL) in `workers/mcp/wrangler.toml`:

```toml
[vars]
MCP_RESOURCE_URL = "https://plotops-mcp.<account>.workers.dev/mcp"
```

Local Worker against local Auth:

```bash
npm run db:start
npm run mcp:dev   # default http://127.0.0.1:8787
```

Set `SUPABASE_URL=http://127.0.0.1:54321` in `workers/mcp/.dev.vars`. The SPA consent page is still Vite (`http://127.0.0.1:5173/oauth/consent`); `additional_redirect_urls` already allows `http://127.0.0.1:5173/**`.

### 3. Add the MCP connector

MCP URL to paste into the client:

```
https://plotops-mcp.<account>.workers.dev/mcp
```

The client should:

1. GET `/.well-known/oauth-protected-resource`
2. Discover `{SUPABASE_URL}/auth/v1` as the authorization server
3. Register (DCR) if it has no client id
4. Authorization-code + PKCE → user signs in on PlotOps → `/oauth/consent`
5. Call `/mcp` with `Authorization: Bearer <access_token>` and `Accept: application/json, text/event-stream`

## Local Auth OAuth server

`supabase/config.toml`:

```toml
[auth.oauth_server]
enabled = true
authorization_url_path = "/oauth/consent"
allow_dynamic_registration = true
```

After changing it: `npm run db:stop && npm run db:start` (or `db:reset` when testing migrations).

## Security notes

- **No service role** in the Worker. RLS (`can_create_tasks`, `can_edit_tasks`, project visibility) is the authorization layer.
- **Token verification:** `auth.getClaims` verifies the ES256 signature against the project JWKS (cached per isolate), `exp`, `iss` (= `{SUPABASE_URL}/auth/v1`) and `role = authenticated` — no Auth round-trip per request. Legacy HS256 tokens fall back to `getUser`. Trade-off: a signed-out session stays usable until its access token expires (default 1 h); PostgREST accepts the same token for the same window.
- **Rate limits:** Cloudflare [Rate Limiting bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/) in `wrangler.toml` — `MCP_IP_LIMITER` 120/min per IP, `MCP_USER_LIMITER` 60/min per user. Counters are per Cloudflare location and approximate (a few extra requests can slip through). If a binding is missing or errors, an in-memory per-isolate window with the same limits applies. No database work per request.
- **Audit log:** tool calls are logged via `log_mcp_action` into `mcp_action_log`; pg_cron job `mcp-action-log-retention` deletes rows older than 30 days nightly (03:17 UTC).
- **Body cap:** 256 KiB. List tools cap at 100 rows.
- **CORS:** reflects `Origin` (Bearer tokens, not cookies).
- **Task UPDATE:** `tasks_protect_system_columns` blocks `id` / `project_id` / `task_key` / `created_at`. Column-level `GRANT UPDATE` matches that whitelist. Git/PR data is not on `tasks` (multi-repo): it lives in `task_git_links`, one row per Task × Repository. Editors can still change `author_id` and Git links through the SPA (`update_task_details`); MCP `update_task` does not send those fields.
- The access token is a normal user JWT. A malicious MCP client that extracts it can call PostgREST directly; RLS still applies. Do not treat MCP as a narrower grant than “this user”.

## Fallback if the OAuth server cannot be enabled

If hosted Auth cannot issue OAuth 2.1 tokens for third-party clients (plan, dashboard, or signing-key constraints), do **not** point the Worker at another Supabase project and do **not** mint JWTs with the service role.

Preferred fallback (not built in this change): **personal API tokens** stored hashed on `profiles` (or a dedicated table), presented as `Authorization: Bearer po_…`, exchanged by the Worker for the user's JWT via a security-definer RPC that only returns a short-lived user-scoped session. Same RLS, no service role on the Worker.

## Files

| Path                                                                  | Role                                  |
| --------------------------------------------------------------------- | ------------------------------------- |
| `workers/mcp/`                                                        | Worker source, `wrangler.toml`, tests |
| `src/routes/oauth/consent.tsx`                                        | Consent page                          |
| `supabase/migrations/20261103084757_mcp_task_rpcs_and_action_log.sql` | RPCs, column lock, `mcp_action_log`   |
| `docs/adr/0034-mcp-oauth-worker.md`                                   | Decision record                       |
