# In-app GitHub PR writes (Open + Merge + Close)

PlotOps can **Open**, **Merge**, and **Close** (without merging) pull requests from the task GitHub panel using the signed-in user’s GitHub `provider_token` (`repo` OAuth scope already requested at login). Approve / request-review stay out of this slice.

## Decision

- **Client GitHub REST** — `POST /repos/{}/pulls`, `PUT /repos/{}/pulls/{}/merge`, and `PATCH /repos/{}/pulls/{}` (`state: closed`) with the user’s token. The action attributes to that GitHub user (correct audit trail).
- **Not** GitHub App installation tokens for writes in this slice (App already used for webhooks only).
- **PlotOps UI gate** (before calling GitHub):
    - Guest / Viewer / archived task → hide write actions.
    - Owner / Admin → any task.
    - Manager / Contributor → only when `auth.uid` is task **author** or **assignee**.
- GitHub remains authoritative for repo rights; 401/403 → reconnect messaging.
- **Base** = Board base branch; **head** = task `branchName`. PR title default `` `${task.key}: ${task.title}` ``.
- Merge confirm dialog; default method **`squash`** (`merge` / `rebase` selectable).
- Close confirm dialog; on success update local `pr_state` to `closed` only (no board column change).
- On merge success, update local `pr_state` only. **`github-webhook`** remains source of truth for moving the Task to the Board’s last column when the PR merges into that Board’s base branch.
- Webhook on `pull_request` closed with `merged=false` sets linked Task `pr_state=closed` only (idempotent; does not move columns; does not downgrade `merged`).

## Consequences

- Users signed in with email-only (no `provider_token`) cannot Open/Merge/Close until they reconnect with GitHub.
- Approve and draft conversion remain deferred.
- Guest Mode never exposes write buttons (fixtures stay read-only).
