#!/usr/bin/env bash
# Dump the Supabase database (roles + schema + data), encrypt it with age and
# upload it to the private R2 bucket. Restore steps: docs/BACKUPS.md.
#
# Usage: scripts/db-backup.sh <label>        # label: pre-migrate | daily | manual
#
# Required env:
#   BACKUP_AGE_RECIPIENT   age public key (age1...); the private key is kept offline
#   R2_BUCKET, R2_ENDPOINT, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY   (upload)
# Optional env:
#   DB_DUMP_TARGET   --linked (default) or --local
#   BACKUP_OUT_DIR   write the encrypted file here instead of uploading (local testing)
#
# Plaintext dumps only ever exist in a 0700 temp dir that is removed on exit.
# Never print them and never upload them as GitHub Actions artifacts: the repo is
# public, so any signed-in GitHub user can download artifacts.
set -euo pipefail

label="${1:?usage: db-backup.sh <label>}"
target="${DB_DUMP_TARGET:---linked}"
: "${BACKUP_AGE_RECIPIENT:?BACKUP_AGE_RECIPIENT is not set}"
if [ -z "${BACKUP_OUT_DIR:-}" ]; then
    : "${R2_BUCKET:?R2_BUCKET is not set}" "${R2_ENDPOINT:?R2_ENDPOINT is not set}"
    : "${AWS_ACCESS_KEY_ID:?R2 access key is not set}" "${AWS_SECRET_ACCESS_KEY:?R2 secret key is not set}"
fi

umask 077
work="$(mktemp -d)"
trap 'rm -rf "$work"' EXIT

supabase db dump "$target" --role-only -f "$work/roles.sql"
supabase db dump "$target" -f "$work/schema.sql"
# Platform tables the postgres role cannot write to on restore (all unused here):
# storage vector tables and the database-webhook log. -x skips their rows but not
# the webhook log's sequence, so drop that setval line too.
supabase db dump "$target" --data-only --use-copy \
    -x storage.buckets_vectors -x storage.vector_indexes -x supabase_functions.hooks \
    -f "$work/data.sql"
sed -i "/^SELECT pg_catalog.setval('\"supabase_functions\"\./d" "$work/data.sql"

# Refuse to store an empty or truncated dump as if it were a good backup.
grep -q 'CREATE TABLE IF NOT EXISTS "public"."tasks"' "$work/schema.sql" ||
    { echo "schema.sql has no public.tasks table; refusing to upload" >&2; exit 1; }
grep -q '^COPY "public"."tasks"' "$work/data.sql" ||
    { echo "data.sql has no public.tasks data; refusing to upload" >&2; exit 1; }

stamp="$(date -u +%Y%m%dT%H%M%SZ)"
sha="$(git rev-parse --short=7 HEAD 2>/dev/null || echo nogit)"
name="${stamp}-${sha}.tar.gz.age"

tar -C "$work" -czf - roles.sql schema.sql data.sql |
    age --encrypt --recipient "$BACKUP_AGE_RECIPIENT" --output "$work/$name"
size="$(wc -c <"$work/$name" | tr -d ' ')"

if [ -n "${BACKUP_OUT_DIR:-}" ]; then
    mkdir -p "$BACKUP_OUT_DIR"
    mv "$work/$name" "$BACKUP_OUT_DIR/$name"
    echo "Wrote $BACKUP_OUT_DIR/$name ($size bytes)"
    exit 0
fi

# AWS CLI >= 2.23 sends extra checksum headers by default; Cloudflare's R2 docs
# recommend sending them only when required.
export AWS_DEFAULT_REGION=auto
export AWS_REQUEST_CHECKSUM_CALCULATION=when_required
export AWS_RESPONSE_CHECKSUM_VALIDATION=when_required
aws s3 cp "$work/$name" "s3://$R2_BUCKET/$label/$name" \
    --endpoint-url "$R2_ENDPOINT" --only-show-errors
echo "Uploaded $label/$name ($size bytes) to R2 bucket $R2_BUCKET"
