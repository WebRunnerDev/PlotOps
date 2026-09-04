# In-app GitHub PR writes (Open + Merge + Close + Approve)

PlotOps can **Open**, **Merge**, **Close**, and **Approve** pull requests from the task GitHub panel using the signed-in user’s GitHub `provider_token` (`repo` OAuth scope already requested at login). Request-review stays out of this slice.

## Decision

- **Client GitHub REST** — `POST /repos/{}/pulls`, `PUT /repos/{}/pulls/{}/merge`, `PATCH /repos/{}/pulls/{}` (close), and `POST /repos/{}/pulls/{}/reviews` (`APPROVE`) with the user’s token. The action attributes to that GitHub user (correct audit trail).
- **Not** GitHub App installation tokens for writes in this slice (App already used for webhooks only).
- **PlotOps Open / Merge / Close gate** (before calling GitHub):
    - Guest / Viewer / archived task → hide write actions.
    - Owner / Admin → any task.
    - Manager / Contributor → only when `auth.uid` is task **author** or **assignee**.
- **PlotOps review gate (Approve)** — distinct from Open/Merge/Close:
    - Guest / Viewer / archived task → hide Approve.
    - Owner / Admin / Manager / Contributor who can access the Project → Approve any open linked PR on that Project (**no** author/assignee restriction; reviewers are usually not the assignee).
    - GitHub still enforces whether that user may approve (e.g. cannot approve own PR when branch protection requires it).
- GitHub remains authoritative for repo rights; 401/403/422 → reconnect / forbidden / validation messaging.
- **Base** = Board base branch; **head** = task `branchName`. PR title default `` `${task.key}: ${task.title}` ``.
- Merge confirm dialog; default method **`squash`** (`merge` / `rebase` selectable).
- Close confirm dialog; sets local `pr_state` to `closed` without merging or moving the Task column.
- Approve has no confirm dialog; success toast only. Does **not** change Task column or local `pr_state` (stays `open` unless GitHub/webhook says otherwise).
- On merge success, update local `pr_state` only. **`github-webhook`** remains source of truth for moving the Task to the Board’s last column when the PR merges into that Board’s base branch.

## Consequences

- Users signed in with email-only (no `provider_token`) cannot Open/Merge/Close/Approve until they reconnect with GitHub.
- Request-review and draft conversion remain deferred.
- Guest Mode never exposes write or review buttons (fixtures stay read-only).
- A Manager/Contributor who is neither author nor assignee can Approve but still cannot Open/Merge/Close that Task’s PR.
