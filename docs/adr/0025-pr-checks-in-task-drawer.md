# PR checks in the task drawer

Linked pull requests in the task GitHub panel show live GitHub Check Runs (Actions, Bugbot/agent apps, and other check suites) as a compact rollup plus an expandable list.

## Decision

- **Client GitHub REST** — resolve PR `head.sha`, then `GET /repos/{}/commits/{sha}/check-runs` with the user’s `provider_token` (same read path as diff/commits).
- **Not** filtered through the CI/CD `buildsProvider` (Actions-only): check-runs include third-party and agent checks.
- **Live only** — React Query; no Supabase columns, no webhook fan-in for check status.
- **Guest Mode** — canned fixtures in `fixture-git-api` (never call GitHub).
- **UI** — rollup badge + collapsible list with external details links. Action job logs stay on the CI/CD page.
- Merge is **not** blocked in PlotOps when checks fail; GitHub remains authoritative for required status checks.

## Consequences

- Email-only sessions without a GitHub token cannot load checks until reconnect (same as other live git reads).
- Legacy Commit Statuses API and GraphQL `statusCheckRollup` stay out of this slice.
- Branch-only / linked-commit checks without a PR are deferred.
