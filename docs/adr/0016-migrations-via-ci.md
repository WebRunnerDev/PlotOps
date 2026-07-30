# Remote schema changes only via CI/CD

Laptop `db push` and MCP `apply_migration` race with each other and with Cloudflare deploys. We apply PlotOps remote migrations only from GitHub Actions on every `main` push (after a PR Docker reset check named `supabase-migrate-check`). Cloudflare does not wait for GitHub checks, so production frontend deploys are triggered by a Deploy Hook only after `migrate` succeeds (automatic CF production deploys stay off). Emergency laptop push remains, but is not the happy path.
