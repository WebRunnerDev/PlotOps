# GitHub App → `github-webhook` setup (Admin)

One-time setup for PlotOps Task sync on PR merge. Free on public repos + Supabase Free. Aimed at a single Admin for a small team (~5).

Does **not** feed CI/CD — only keeps Task Git links in sync with PRs and moves Tasks when their PRs merge into the Board Base branch. A Project can hold several Repositories (ADR 0035); install the App on each of them.

## Prerequisites

- PlotOps Supabase project: `ijcelrdcygzyzhcijkhe`
- Edge Function `github-webhook` deployed
- Project(s) in PlotOps with the repo(s) added under Project Settings → Repositories (`project_repositories`)

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

1. In PlotOps, link a Task to a branch/PR on that repo (or ensure `task_key` appears in the head branch, e.g. `feature/TASK-12-…` — the webhook then creates the Git link itself).
2. Open a PR into the Board’s **Base branch** for that repo and merge it on GitHub.
3. Within a few seconds the Task should move (once **every** PR on it is merged — see below) to the Board’s **merge target column** (Project Settings → Boards → _After a PR merges, move the task to_; default: last column); another open browser on the Board should see the card move via Realtime. With _Don’t move_, only the PR badge turns merged.
4. Task activity should show actor **GitHub** with the PR change (and the status change when the Task moved).

### If nothing moves

- Supabase Dashboard → Edge Functions → `github-webhook` → Logs; look for `reason`:

| `reason`            | Meaning                                                                                                              |
| ------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `invalid_signature` | `GITHUB_WEBHOOK_SECRET` and the App secret differ                                                                    |
| `no_project`        | No Repository with this GitHub repo id (`project_repositories.github_repo_id`) — add it to the Project               |
| `no_task`           | No Task matched by PR number, branch, or `task_key` in the head ref                                                  |
| `link_conflict`     | Task found by branch / `task_key`, but its Git link for this Repository holds another PR or branch — not overwritten |
| `wrong_base`        | PR merged into a branch other than the Board’s Base branch for this Repository; the Task waits                       |
| `pending_prs`       | This PR is merged, but other PRs on the Task are still open                                                          |
| `already_synced`    | Redelivery of a merge already applied                                                                                |

- Confirm the PR base branch equals the Base branch of the Task’s Board for **that** Repository (Project Settings → Boards).
- Confirm the App is installed on that repository.

## 5. App status

Project Settings → Repositories shows, per Repository, whether the App is installed and links to its install page. The browser cannot ask GitHub this with the user's OAuth token, so the `github-app-status` Edge Function signs an App JWT and calls `GET /repos/{owner}/{repo}/installation`.

1. GitHub App settings → **Private keys → Generate a private key** (`.pem`, PKCS#1 is fine).
2. Set the secrets (never `VITE_*`):

    ```bash
    npx supabase secrets set GITHUB_APP_ID="<App ID>" --project-ref ijcelrdcygzyzhcijkhe
    npx supabase secrets set GITHUB_APP_PRIVATE_KEY="$(cat plotops.private-key.pem)" --project-ref ijcelrdcygzyzhcijkhe
    # Optional — otherwise read from GET /app:
    npx supabase secrets set GITHUB_APP_SLUG="<app-slug>" --project-ref ijcelrdcygzyzhcijkhe
    ```

3. Deploy: `npx supabase functions deploy github-app-status --project-ref ijcelrdcygzyzhcijkhe` (`verify_jwt = true`).

Without the secrets, or when GitHub rejects the App JWT (log `reason: app_auth_failed`), every Repository shows _App status unavailable_; the page keeps working. Callers only see Repositories of Projects in their Teams (RLS); 120 requests per user per hour.

## Matching

1. **Repository first.** `repository.id` from the payload → `project_repositories.github_repo_id` → Project. The id survives repo renames.
2. **Task**, within that Repository’s Git links: `(repository, pr_number)` → `(repository, branch)` → `task_key` in the head ref (e.g. `feature/TASK-12-…`). Equal PR numbers in two Repositories never collide.
3. **Auto-link.** A Task matched only by `task_key` that has no Git link for this Repository gets one (head branch + PR) on `opened`, `reopened` and `closed`. An existing Git link is never overwritten (`link_conflict`).

## Merge rule

A Task moves to its Board’s merge target column only when **every** Git link with a PR is merged into its Board × Repository Base branch:

- PRs closed without merge and branch-only Git links do not count. Closing the last open PR without merge can therefore complete the set and move the Task.
- A PR merged elsewhere (`wrong_base`) keeps the Task waiting.
- Each merge records the PR change in activity; the status change and notifications come with the event that completes the set.

## Behaviour summary

| Event                                                        | Result                                                                                                                     |
| ------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| `pull_request` opened                                        | Match Task → Git link `pr_state=open` (auto-link if needed); no column change                                              |
| `pull_request` closed + merged into Board × Repo Base branch | Git link `pr_state=merged` + activity; when all PRs are merged → merge target column (default last column; none = no move) |
| `pull_request` closed + merged into another branch           | `wrong_base` log, nothing written                                                                                          |
| `pull_request` closed + not merged                           | Git link `pr_state=closed`; moves the Task only if the remaining PRs are all merged                                        |
| `pull_request` reopened                                      | Git link `pr_state=open` only (no column change)                                                                           |
| `push`                                                       | 200 no-op                                                                                                                  |
| No matching Repository/Task, conflict, wrong base            | 200 + log (no GitHub retry storm)                                                                                          |
| Bad HMAC                                                     | 401                                                                                                                        |
