# Playwright e2e

## Guest Mode (default CI)

```bash
npm run build
npm run test:e2e
```

Uses the client-side Guest Session (“Try demo”). No local Supabase required. CI sets placeholder `VITE_SUPABASE_*` values.

Guest Watch helpers: `e2e/helpers/guest-watch.ts`.

## Auth harness (opt-in)

Multi-user Watch coverage against **local Docker Supabase** (A Owner, B Viewer, C Contributor). Specs under `e2e/auth-*.spec.ts` **skip** unless `E2E_AUTH=1`.

Full setup: [docs/SUPABASE.md → Auth e2e harness](../docs/SUPABASE.md).

```bash
npm run db:reset
# .env.local → VITE_SUPABASE_URL=http://127.0.0.1:54321 + publishable key
npm run build
npm run test:e2e:auth
```

Helpers: `e2e/helpers/auth-harness.ts`. Specs: `e2e/auth-harness.spec.ts` (smoke), `e2e/auth-manage-watchers.spec.ts` (#256), `e2e/auth-mentionee-dedupe.spec.ts` (#257).
