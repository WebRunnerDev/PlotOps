# Supabase (PlotOps)

Remote project ref: **ijcelrdcygzyzhcijkhe** (from `VITE_SUPABASE_URL` in `.env`).

## One-time setup

```bash
npm install
npx supabase login
npm run db:link
# enter database password from Supabase Dashboard → Project Settings → Database
npm run db:push
```

`db:link` writes `supabase/.temp/project-ref` (gitignored). Re-run only if you clone the repo on a new machine.

## Day-to-day

| Command | Purpose |
|---------|---------|
| `npm run db:new -- add_tasks` | Create a new migration file |
| `npm run db:push` | Apply pending migrations to PlotOps |
| `npm run db:status` | Compare local vs remote migration history |

## MCP + two projects

Supabase MCP is account-scoped, not project-scoped. Agents must use **project_id = `ijcelrdcygzyzhcijkhe`** for this repo (see `.cursor/rules/plotops.mdc`). No need to unbind/rebind MCP when switching repos — only pass the correct ref.

If MCP cannot access PlotOps, use CLI (`db:push`) or SQL Editor in the PlotOps dashboard.

## Auth (email signup + confirm)

Local (`supabase/config.toml`): `auth.email.enable_confirmations = true`, `site_url` / redirect URLs point at Vite (`:5173`).

**Remote Dashboard (required — not applied by migrations):**

1. Authentication → Providers → Email → enable **Confirm email**
2. Authentication → URL Configuration → add app origins to **Redirect URLs** (local Vite + production), and set **Site URL** to the production origin

Without Confirm email ON remotely, `signUp` returns a session immediately and the check-email UI never appears.

## Migrations

- `supabase/migrations/20260710120000_create_projects.sql` — `projects` table, RLS, GitHub fields (idempotent)
- `supabase/migrations/20260710150000_create_profiles.sql` — `profiles` table, signup trigger, backfill for existing users
- `supabase/migrations/20260710160000_fix_profile_timestamps.sql` — adds missing `created_at` / `updated_at` on legacy `profiles` rows
- `supabase/migrations/20260710170000_repair_profile_triggers.sql` — drops broken triggers, repairs columns, recreates triggers
