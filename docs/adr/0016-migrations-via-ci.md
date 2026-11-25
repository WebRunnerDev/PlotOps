# Remote schema changes only via CI/CD

Laptop `db push` and MCP `apply_migration` race with each other and with Cloudflare deploys. We apply PlotOps remote migrations only from GitHub Actions on every `main` push (after a PR Docker reset check named `supabase-migrate-check`). Cloudflare does not wait for GitHub checks, so production frontend deploys are triggered by a Deploy Hook only after `migrate` succeeds (automatic CF production deploys stay off). Emergency laptop push remains, but is not the happy path.

## Destructive changes: expand / contract (2026-11-25)

The frontend deploys only after `migrate`, and old bundles stay open in users' tabs; every Cloudflare branch preview also runs against the production database. So for a while, code that predates a migration runs against the new schema. A migration must keep working with the code that is live before it:

1. **Expand** — add the new column, table or function; the old code ignores it.
2. **Migrate code** — ship the code that uses the new shape and no longer reads or writes the old one.
3. **Contract** — in a later release, drop or rename the old shape.

Never drop or rename a column, table, enum value or function signature that the deployed bundle still uses in the same release. A backfill that overwrites existing values is destructive too. Every migration run is preceded by an encrypted backup ([BACKUPS.md](../BACKUPS.md)); that is a recovery path, not a reason to skip the steps.
