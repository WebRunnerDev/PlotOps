# GitHub App → `github-webhook` setup (Admin)

One-time setup for PlotOps Task sync on PR merge. Free on public repos + Supabase Free. Aimed at a single Admin for a small team (~5).

Does **not** feed CI/CD — only moves Tasks when a PR merges into the Board Base branch.

## Prerequisites

- PlotOps Supabase project: `ijcelrdcygzyzhcijkhe`
- Edge Function `github-webhook` deployed
- Project(s) in PlotOps with `github_full_name` set to the linked repo (e.g. `owner/repo`)

## 1. Webhook secret

Generate a long random secret (e.g. `openssl rand -hex 32`). You will paste the **same** value in:

1. Supabase Edge Function secrets as `GITHUB_WEBHOOK_SECRET`
2. GitHub App webhook secret

```bash
# From repo root, after supabase login + link:
npx supabase secrets set GITHUB_WEBHOOK_SECRET="<your-secret>" --project-ref ijcelrdcygzyzhcijkhe
```

`SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are provided automatically to Edge Functions.

## 2. Deploy the function

```bash
npx supabase functions deploy github-webhook --project-ref ijcelrdcygzyzhcijkhe
```

Confirm `verify_jwt = false` is pinned in [`supabase/config.toml`](../supabase/config.toml) under `[functions.github-webhook]`.

**Webhook URL:**

```text
https://ijcelrdcygzyzhcijkhe.supabase.co/functions/v1/github-webhook
```

## 3. Create the GitHub App

1. GitHub → **Settings → Developer settings → GitHub Apps → New GitHub App**
2. **Webhook URL:** the URL above
3. **Webhook secret:** same as `GITHUB_WEBHOOK_SECRET`
4. **Permissions:** Repository → **Pull requests** (Read-only) is enough for merge events; **Contents** not required for this sync
5. **Subscribe to events:** `Pull request`, `Push`
6. Create the App, then **Install App** on the team repos PlotOps projects use

## 4. Smoke test

1. In PlotOps, link a Task to a branch/PR on that repo (or ensure `task_key` appears in the head branch, e.g. `feature/TASK-12-…`).
2. Open a PR into the Board’s **Base branch** and merge it on GitHub.
3. Within a few seconds the Task should move to the Board’s **last column**; another open browser on the Board should see the card move via Realtime.
4. Task activity should show actor **GitHub** with the status change.

### If nothing moves

- Supabase Dashboard → Edge Functions → `github-webhook` → Logs (look for `reason`: `invalid_signature`, `no_project`, `no_task`, `wrong_base`, `already_synced`).
- Confirm `projects.github_full_name` matches `owner/repo` exactly.
- Confirm PR base branch equals the Task’s Board `base_branch`.
- Confirm the App is installed on that repository.

## Behaviour summary

| Event                                                 | Result                                                  |
| ----------------------------------------------------- | ------------------------------------------------------- |
| `pull_request` closed + merged into Board Base branch | Match Task → last column + `pr_state=merged` + activity |
| `pull_request` closed + not merged                    | Match Task → `pr_state=closed` only (no column change)  |
| `push`                                                | 200 no-op                                               |
| No matching Project/Task / wrong base                 | 200 + log (no GitHub retry storm)                       |
| Bad HMAC                                              | 401                                                     |
