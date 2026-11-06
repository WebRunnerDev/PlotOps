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
4. **Permissions:** Repository → **Pull requests** (Read-only) and **Contents** (Read-only). Contents is needed for the `Create` event and for the backfill to list branches.
5. **Subscribe to events:** `Pull request`, `Create`, `Push`
6. Create the App, then **Install App** on the team repos PlotOps projects use

## 4. Smoke test

1. In PlotOps, link a Task to a branch/PR on that repo, or just push a branch with the task key (e.g. `TASK-12-login`) — the webhook then creates the Git link itself. A PR whose title or body names the key works too.
2. Open a PR into the Board’s **Base branch** for that repo and merge it on GitHub.
3. Within a few seconds the Task should move (once **every** PR on it is merged — see below) to the Board’s **merge target column** (Project Settings → Boards → _After a PR merges, move the task to_; default: last column); another open browser on the Board should see the card move via Realtime. With _Don’t move_, only the PR badge turns merged.
4. Task activity should show actor **GitHub** with the PR change (and the status change when the Task moved).

### If nothing moves

- Supabase Dashboard → Edge Functions → `github-webhook` → Logs; look for `reason`:

| `reason`            | Meaning                                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `invalid_signature` | `GITHUB_WEBHOOK_SECRET` and the App secret differ                                                                  |
| `no_project`        | No Repository with this GitHub repo id (`project_repositories.github_repo_id`) — add it to the Project             |
| `no_task`           | No Task matched by PR number, branch, or a task key in the head ref, PR title or PR body                           |
| `link_conflict`     | Task found by branch / task key, but its Git link for this Repository holds another PR or branch — not overwritten |
| `dismissed`         | Someone unlinked this PR / branch from the Task by hand — auto-link leaves it alone                                |
| `already_linked`    | `create` for a branch the Task's Git link already holds                                                            |
| `wrong_base`        | PR merged into a branch other than the Board’s Base branch for this Repository; the Task waits                     |
| `pending_prs`       | This PR is merged, but other PRs on the Task are still open                                                        |
| `already_synced`    | Redelivery of a merge already applied                                                                              |

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
2. **Tasks**, within that Repository’s Git links: `(repository, pr_number)` → `(repository, branch)` → a task key anywhere in the head branch, PR title or PR body, case-insensitive (`TASK-12-login`, `user/foo-TASK-12`, `TASK-12: Fix login`). One event can match several Tasks: a PR naming `TASK-1` and `TASK-2` links to both. Equal PR numbers in two Repositories never collide. Key extraction is shared with the app (`supabase/functions/_shared/task-key.ts`).
3. **Auto-link.** A Task matched only by task key that has no Git link for this Repository gets one: head branch + PR on `opened`, `reopened` and `closed`; branch only on `create`. A PR opened later from that branch joins the same Git link. An existing Git link is never overwritten (`link_conflict`). Activity shows _Linked automatically by key TASK-12_ (`metadata.auto_link.key`).
4. **Manual unlink wins.** When a person removes a branch or PR from a Git link, `task_git_link_dismissals` remembers it (a trigger on `task_git_links`, only for signed-in users). Auto-link never brings that branch / PR back to that Task (`dismissed`). Linking it again by hand (or Undo) lifts the dismissal.

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
| `create` (ref_type=branch)                                   | Branch-only Git link on each Task whose key is in the branch name and that has no Git link there                           |
| `push`                                                       | 200 no-op                                                                                                                  |
| No matching Repository/Task, conflict, wrong base            | 200 + log (no GitHub retry storm)                                                                                          |
| Bad HMAC                                                     | 401                                                                                                                        |

## 6. Backfill

Branches and PRs that existed before the App or the Repository was connected never sent an event. The `github-backfill` Edge Function fetches them: it signs an App JWT, takes an installation token scoped to the repository, lists open PRs (up to 300) and branches (up to 1000), and replays the ones that refer to a Task through the same sync as the webhook, with the same rules (no overwrite, no relink after a manual unlink).

- **When:** the refresh button in the drawer's GitHub block (every Repository of the Project), and right after a Repository is connected in Project Settings.
- **Who:** editors of the Project (`can_edit_tasks`); 30 requests per user per hour.
- **Secrets:** the same `GITHUB_APP_ID` / `GITHUB_APP_PRIVATE_KEY` as App status.
- **Deploy:** `npx supabase functions deploy github-backfill --project-ref ijcelrdcygzyzhcijkhe` (`verify_jwt = true`).

The answer lists each Repository as `synced`, `not_installed` (no installation, so no token) or `unavailable` (GitHub failed).
