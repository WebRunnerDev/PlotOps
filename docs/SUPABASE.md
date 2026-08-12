# Supabase (PlotOps)

Remote project ref: **ijcelrdcygzyzhcijkhe**.

Migrations live in `supabase/migrations/`. They are **not** applied by `npm run dev`.

| Target             | How                                                                                                |
| ------------------ | -------------------------------------------------------------------------------------------------- |
| **Local Docker**   | `npm run db:start` / `npm run db:reset` → Postgres on `127.0.0.1`                                  |
| **Remote PlotOps** | **CI/CD** — GitHub Actions on `main` runs `supabase db push`, then triggers Cloudflare (see below) |

**Rule for agents and local work:** create and verify migrations against Docker only. Commit the SQL files. Do **not** run `npm run db:push`, `supabase db push`, or Supabase MCP `apply_migration` against remote unless the human explicitly asks for an emergency/manual apply.

Decision record: [`docs/adr/0016-migrations-via-ci.md`](adr/0016-migrations-via-ci.md).

## Local stack (default for schema work)

Requires [Docker Desktop](https://docs.docker.com/desktop/) running.

```bash
npm run db:start          # first run pulls images; applies all migrations
# copy API URL + anon/publishable key from the printed status into .env.local:
#   VITE_SUPABASE_URL=http://127.0.0.1:54321
#   VITE_SUPABASE_PUBLISHABLE_KEY=<anon key>
npm run dev               # Vite prefers .env.local over .env → hits local DB
```

After adding a migration:

```bash
npm run db:new -- <name>  # or: npx supabase migration new <name>
# edit supabase/migrations/<timestamp>_<name>.sql
npm run db:reset          # wipe local DB, re-run all migrations + [db.seed] sql_paths
```

Keep remote credentials in `.env`. Use `.env.local` only while developing against Docker (both are gitignored). Delete or rename `.env.local` to point the app back at remote.

| Command                    | Purpose                        |
| -------------------------- | ------------------------------ |
| `npm run db:start`         | Start local Supabase (Docker)  |
| `npm run db:stop`          | Stop local stack               |
| `npm run db:reset`         | Reset local DB from migrations |
| `npm run db:local-status`  | Print local URL/keys           |
| `npm run db:new -- <name>` | Create a new migration file    |

### Local GitHub OAuth

Remote PlotOps already has GitHub in the cloud Dashboard. Local Auth does **not** reuse that — you need a second GitHub OAuth App.

1. GitHub → **Settings → Developer settings → OAuth Apps → New OAuth App**
    - Homepage URL: `http://127.0.0.1:5173`
    - Authorization callback URL: `http://127.0.0.1:54321/auth/v1/callback`  
      (local GoTrue, **not** the Vite origin and not the remote `*.supabase.co` callback)
2. Copy Client ID and generate a Client Secret.
3. Add to root `.env` (gitignored; CLI reads these when starting local stack):

```env
SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID=Ov23...
SUPABASE_AUTH_EXTERNAL_GITHUB_SECRET=ghp_or_oauth_secret...
```

4. Restart local stack so GoTrue picks up secrets:

```bash
npm run db:stop
npm run db:start
```

5. Keep `.env.local` pointing at `http://127.0.0.1:54321`, then `npm run dev` → Sign in with GitHub.

Scopes used by the app: `repo read:user` (see `signInWithGitHub`). Without this setup, use email/password on local or remove `.env.local` to hit remote.

## Remote (PlotOps cloud)

Schema changes reach remote via **GitHub Actions** after the migration file is merged to `main`. Day-to-day development should not push schema from a workstation. Edge Functions are **not** deployed by this pipeline (manual / later).

### CI/CD workflows

| Workflow                                                                                          | Trigger                       | What it does                                                                                                                       |
| ------------------------------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| [`.github/workflows/supabase-migrate-check.yml`](../.github/workflows/supabase-migrate-check.yml) | `pull_request`                | Local Docker: `supabase start` + `db reset` when `supabase/migrations/**` (etc.) change. Check name: **`supabase-migrate-check`**. |
| [`.github/workflows/supabase-migrate.yml`](../.github/workflows/supabase-migrate.yml)             | `push` to `main` (every push) | `supabase link` + `db push` to PlotOps, then POST Cloudflare Deploy Hook. Job/check name: **`migrate`**.                           |

### One-time GitHub setup

Repository → **Settings → Secrets and variables → Actions** — add secrets:

| Secret                             | Where to get it                                                                   |
| ---------------------------------- | --------------------------------------------------------------------------------- |
| `SUPABASE_ACCESS_TOKEN`            | [Supabase Account → Access Tokens](https://supabase.com/dashboard/account/tokens) |
| `SUPABASE_DB_PASSWORD`             | Project Settings → Database → Database password                                   |
| `SUPABASE_PROJECT_ID`              | `ijcelrdcygzyzhcijkhe` (PlotOps ref)                                              |
| `CLOUDFLARE_PAGES_DEPLOY_HOOK_URL` | Cloudflare project → Settings → Builds → Deploy Hooks (production branch)         |

Branch protection on `main`: require status check **`supabase-migrate-check`** before merge.

### One-time Cloudflare setup (migrations before frontend)

Cloudflare Pages/Workers **does not wait** for an arbitrary GitHub check. To keep schema ahead of the UI:

1. Disable **automatic production branch deployments** (Branch control).
2. Create a **Deploy Hook** for the production branch; paste the URL into `CLOUDFLARE_PAGES_DEPLOY_HOOK_URL`.
3. Production builds then start only after the `migrate` job succeeds and POSTs the hook.

Until the Deploy Hook secret exists, the migrate job still pushes schema; the CF trigger step no-ops with a log line.

### Emergency laptop link / push

Optional one-time link (status / emergency only):

```bash
npx supabase login
npm run db:link
# enter database password from Supabase Dashboard → Project Settings → Database
```

`db:link` writes `supabase/.temp/project-ref` (gitignored). Re-run only if you clone the repo on a new machine.

| Command             | Purpose                                                                              |
| ------------------- | ------------------------------------------------------------------------------------ |
| `npm run db:status` | Compare local vs remote migration history (read-only)                                |
| `npm run db:push`   | **Emergency only** — apply pending migrations to remote; requires explicit human ask |

## MCP + two projects

Supabase MCP is account-scoped, not project-scoped. Agents must use **project_id = `ijcelrdcygzyzhcijkhe`** for this repo (see `.cursor/rules/plotops.mdc`). No need to unbind/rebind MCP when switching repos — only pass the correct ref.

Do **not** use MCP `apply_migration` (or equivalent) to change PlotOps remote schema as part of normal feature work — same rule as `db:push`. Prefer local Docker + commit; let CI apply remote. If MCP cannot access PlotOps for read-only checks, use Dashboard SQL Editor or CLI `db:status` — not a silent push.

## Auth (email signup + confirm)

Local (`supabase/config.toml`): `auth.email.enable_confirmations = true`, `site_url` / redirect URLs point at Vite (`:5173`).

**Remote Dashboard (required — not applied by migrations):**

1. Authentication → Providers → Email → enable **Confirm email**
2. Authentication → URL Configuration → add app origins to **Redirect URLs** (local Vite + production), and set **Site URL** to the production origin

Without Confirm email ON remotely, `signUp` returns a session immediately and the check-email UI never appears.

## Guest Mode (product vs local Docker)

**Product “Try demo”** starts a client-side Guest Session (`features/guest-mode`) with a TypeScript/JSON seed in `sessionStorage`. It does **not** sign into a shared Supabase account and makes zero Auth/DB/Realtime calls. See ADR 0018.

**Optional local Docker SQL seed** below remains for full-stack / RLS experiments only. It is **not** the product Guest path. Do not wire app code to demo credentials.

On every `npm run db:reset`, `[db.seed]` runs:

1. `supabase/seed.sql` — local-only demo auth user + `profiles` row
2. `supabase/seed-guest-dataset.sql` — Team, Projects, boards/columns, ~15 tasks, sprints, activity, comments, watchers, notifications

| Field    | Value                                                            |
| -------- | ---------------------------------------------------------------- |
| User id  | `a0000000-0000-4000-8000-000000000001` (local seed only)         |
| Email    | `demo@plotops.app`                                               |
| Password | `plotops-demo-local` (**local-only** — documented, not a secret) |
| Team id  | `b0000000-0000-4000-8000-000000000001` (PlotOps Demo Team)       |

**Dataset shape (fixed UUIDs in `seed-guest-dataset.sql`):**

| Entity   | Count / notes                                                     |
| -------- | ----------------------------------------------------------------- |
| Team     | 1 — guest is `owner_id` (no `team_members` row required)          |
| Projects | 2 — `PlotOps Demo` (fake `github_*`) + `Marketing Site` (no repo) |
| Boards   | 1 Main per project (project insert trigger) + default columns     |
| Tasks    | 15 — labels, priority, assignee, branch/PR where useful           |
| Sprints  | active “Sprint 14 — Demo Launch” + draft “Sprint 15 — Polish”     |
| Extras   | activity_log, comments, watchers, a few inbox notifications       |

There are no `VITE_GUEST_*` product env vars. Local seed credentials are for optional manual password sign-in against Docker only.

### Remote one-time seed (ops / not product)

CI / `supabase db push` must **never** run seed against production. Product Guest Mode does not use a remote shared demo account. If a historical remote `demo@` user still exists, leave it (ops/manual deletion is out of band); the app no longer signs into it.

1. **Auth user (optional, local-parity experiments):** Dashboard → Authentication → Users → Add user, or Admin API. Prefer UUID `a0000000-0000-4000-8000-000000000001` and email `demo@plotops.app` only if you intentionally mirror Docker seed rows remotely.
2. **Profile:** ensure `public.profiles` has a complete row for that user (trigger on signup usually does; otherwise upsert username/first/last like `seed.sql`).
3. **App tables:** SQL Editor → paste and run all of [`supabase/seed-guest-dataset.sql`](../supabase/seed-guest-dataset.sql). It is idempotent on the fixed team id (skips if already present). Do **not** paste `seed.sql` auth inserts into remote unless you know you need them — prefer Dashboard/Admin for `auth.users`.
4. **Reseed:** delete the demo team (`b0000000-0000-4000-8000-000000000001`) or wipe only guest rows, then re-run `seed-guest-dataset.sql`. Never `db reset` remote.

## Edge Functions

Functions live under `supabase/functions/`. They are **not** deployed by the migration CI pipeline — deploy manually when needed.

| Function           | JWT                        | Purpose                                                                                                |
| ------------------ | -------------------------- | ------------------------------------------------------------------------------------------------------ |
| `github-webhook`   | Off (`verify_jwt = false`) | GitHub App PR merge → Task column sync — see [`docs/github-webhook-setup.md`](github-webhook-setup.md) |
| `send-team-invite` | On (`verify_jwt = true`)   | Best-effort Resend email for **email-kind** Team invites (copy-link remains primary)                   |

### `send-team-invite` (Resend)

After `createTeamInvite` (email kind), the client invokes this function with the caller’s JWT. Open invites (`kind = open`) never call it.

**Secrets** (Dashboard → Edge Functions → Secrets, or CLI — never `VITE_*`):

| Secret              | Required | Notes                                                                                                                                                  |
| ------------------- | -------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `RESEND_API_KEY`    | For send | [Resend](https://resend.com) API key. If unset, function returns `200` + `{ skipped: true }` and logs skip metadata only (never the invite URL/token). |
| `INVITE_FROM_EMAIL` | For send | Verified Resend from address, e.g. `PlotOps <invites@yourdomain.com>`.                                                                                 |
| `INVITE_APP_ORIGIN` | For send | Canonical app origin for invite links (`https://app.example.com`). Required when Resend is configured — never taken from the SPA (phishing risk).      |

`SUPABASE_URL` and `SUPABASE_ANON_KEY` are provided automatically to Edge Functions.

```bash
# Set secrets (PlotOps remote)
npx supabase secrets set RESEND_API_KEY="re_..." INVITE_FROM_EMAIL="PlotOps <invites@yourdomain.com>" INVITE_APP_ORIGIN="https://your-app.example" --project-ref ijcelrdcygzyzhcijkhe

# Deploy
npx supabase functions deploy send-team-invite --project-ref ijcelrdcygzyzhcijkhe
```

**Local:** `npm run db:start` serves functions; omit Resend secrets to exercise the no-op path (invite still created + copy-link in UI). Confirm `verify_jwt = true` under `[functions.send-team-invite]` in `supabase/config.toml`.

**Auth:** caller must be able to `SELECT` the invite under RLS (`can_manage_team_members`). Only `kind = email` + `status = pending` are sent.

## Migrations

- `supabase/migrations/20260710120000_create_projects.sql` — `projects` table, RLS, GitHub fields (idempotent)
- `supabase/migrations/20260710150000_create_profiles.sql` — `profiles` table, signup trigger, backfill for existing users
- `supabase/migrations/20260710160000_fix_profile_timestamps.sql` — adds missing `created_at` / `updated_at` on legacy `profiles` rows
- `supabase/migrations/20260710170000_repair_profile_triggers.sql` — drops broken triggers, repairs columns, recreates triggers
