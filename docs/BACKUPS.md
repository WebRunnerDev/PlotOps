# Database backups

Production Supabase has no platform backups (Free plan, no PITR), so we keep our own.

| What                   | Where                                                                                                                         |
| ---------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Script                 | `scripts/db-backup.sh` — `supabase db dump` (roles, schema, data) → tar.gz → `age` → R2                                       |
| Before every migration | `.github/workflows/supabase-migrate.yml`, step "Back up database to R2". If it fails, `db push` does not run.                 |
| Daily                  | `.github/workflows/db-backup.yml`, 02:17 UTC; run it by hand from the Actions tab (`manual/` prefix)                          |
| Bucket                 | Cloudflare R2 `plotops-db-backups`, private (no r2.dev, no custom domain)                                                     |
| Retention              | lifecycle rule deletes objects after 30 days; lock rule `backups-30d` stops deletion before 30 days, even with a leaked token |
| Object keys            | `pre-migrate/`, `daily/`, `manual/` + `<UTC timestamp>-<commit>.tar.gz.age`                                                   |

GitHub environment `production` (deployments allowed from `main` and `dev` only):

- variables: `R2_BUCKET`, `R2_ENDPOINT`, `BACKUP_AGE_RECIPIENT` (age public key), `SUPABASE_PROJECT_ID`;
- secrets: `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` (R2 token: Object Read & Write, this bucket only).

The age **private** key is kept offline by the project owner. CI can encrypt but never
decrypt. Without the private key the backups cannot be read — keep at least two copies of
it (password manager + offline).

Never upload a dump as a GitHub Actions artifact or attach it to an issue: the repository
is public.

## Not covered

- **Storage files** (task images in the `task-media` bucket). The dump keeps only their
  `storage.objects` rows, not the files.
- **pg_cron jobs**. They are created by `cron.schedule()` in migrations and are not in the
  dump; re-run those statements after a restore into a new project.
- **Edge Function secrets, Auth settings and other dashboard config.**

## Restore

Work in a `0700` directory and delete the plaintext files when done: they contain every
user's data, including password hashes.

### 1. Download and decrypt

Download the object from the Cloudflare dashboard (R2 → `plotops-db-backups`) or:

```bash
npx wrangler r2 object get "plotops-db-backups/pre-migrate/<name>.tar.gz.age" --remote --file backup.tar.gz.age
umask 077 && mkdir restore
age --decrypt -i ~/path/to/plotops-backup-age.key backup.tar.gz.age | tar -xz -C restore
# restore/roles.sql, restore/schema.sql, restore/data.sql
```

### 2a. Recover some rows (a bad migration or a bad backfill)

Prefer this to a full restore: load the backup into a throwaway local database, then copy
only the affected rows or tables back to production.

The throwaway database must have current `auth` and `storage` schemas. In a real project
the platform creates them; locally, copy them from the running local stack (`supabase start`):

```bash
img=$(docker inspect supabase_db_PlotOps --format '{{.Config.Image}}')
docker run -d --rm --name plotops-restore -e POSTGRES_PASSWORD=postgres "$img"
docker exec supabase_db_PlotOps pg_dump -U postgres --schema-only -n auth -n storage > restore/platform.sql
docker cp restore plotops-restore:/restore

psql_r() { docker exec -e PGPASSWORD=postgres plotops-restore psql -h localhost -d postgres "$@"; }
psql_r -U supabase_admin -q -c 'drop schema auth cascade; drop schema storage cascade'
psql_r -U supabase_admin -q -f /restore/platform.sql   # a few errors about public.* are expected
psql_r -U postgres --single-transaction -v ON_ERROR_STOP=1 \
    -f /restore/roles.sql -f /restore/schema.sql \
    -c 'SET session_replication_role = replica' -f /restore/data.sql
```

This procedure was tested on 2026-11-25: row counts and checksums of `public.tasks`,
`public.task_comments` and `auth.users` matched the source database.

### 2b. Full restore (the production database is lost)

1. Create a new Supabase project (same region, same Postgres major version).
2. Restore into it, using its connection string from the dashboard:

    ```bash
    psql "$NEW_DB_URL" --single-transaction -v ON_ERROR_STOP=1 \
        -f restore/roles.sql -f restore/schema.sql \
        -c 'SET session_replication_role = replica' -f restore/data.sql
    ```

3. Mark the migrations as applied, so that the next `db push` does not re-run them:
   `supabase link --project-ref <new>`, then
   `supabase migration repair --status applied <every version in supabase/migrations>`.
4. Re-run the `cron.schedule()` statements from the migrations, deploy the Edge Functions
   and set their secrets, and copy the Auth settings.
5. Point the app at the new project: GitHub secrets `SUPABASE_*`, Cloudflare Pages
   environment variables, the MCP worker.
