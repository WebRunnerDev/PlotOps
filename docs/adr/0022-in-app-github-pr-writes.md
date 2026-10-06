# In-app GitHub PR writes (Open + Merge + Close + Reopen + Approve)

PlotOps can **Open**, **Merge**, **Close**, **Reopen**, and **Approve** pull requests from the task GitHub panel using the signed-in user’s GitHub `provider_token` (`repo` OAuth scope already requested at login). Request-review stays out of this slice.

## Decision

- **Client GitHub REST** — `POST /repos/{}/pulls`, `PUT /repos/{}/pulls/{}/merge`, `PATCH /repos/{}/pulls/{}` (close: `state=closed`; reopen: `state=open`), and `POST /repos/{}/pulls/{}/reviews` (`APPROVE`) with the user’s token. The action attributes to that GitHub user (correct audit trail).
- **Not** GitHub App installation tokens for writes in this slice (App already used for webhooks only).
- **PlotOps Open / Merge / Close / Reopen gate** (before calling GitHub):
    - Guest / Viewer / archived task → hide write actions.
    - Owner / Admin → any task.
    - Manager / Contributor → only when `auth.uid` is task **author** or **assignee**.
- **PlotOps review gate (Approve)** — distinct from Open/Merge/Close/Reopen:
    - Guest / Viewer / archived task → hide Approve.
    - Owner / Admin / Manager / Contributor who can access the Project → Approve any open linked PR on that Project (**no** author/assignee restriction; reviewers are usually not the assignee).
    - GitHub still enforces whether that user may approve (e.g. cannot approve own PR when branch protection requires it).
- GitHub remains authoritative for repo rights; 401/403/422 → reconnect / forbidden / validation messaging.
- **Base** = Board base branch; **head** = task `branchName`. PR title default `` `${task.key}: ${task.title}` ``.
- Merge confirm dialog; default method **`squash`** (`merge` / `rebase` selectable).
- Close confirm dialog; sets local `pr_state` to `closed` without merging or moving the Task column.
- Reopen is offered only when the linked PR is `closed` (never `merged`); no confirm dialog (non-destructive). Sets local `pr_state` back to `open` without moving the Task column, so Merge/Close/Approve become available again. GitHub may still refuse (e.g. head branch deleted → 422 validation message).
- Approve has no confirm dialog; success toast only. Does **not** change Task column or local `pr_state` (stays `open` unless GitHub/webhook says otherwise).
- On merge success, update local `pr_state` only. **`github-webhook`** remains source of truth for moving the Task to the Board’s last column when the PR merges into that Board’s base branch.

## Consequences

- Users signed in with email-only (no `provider_token`) cannot Open/Merge/Close/Reopen/Approve until they reconnect with GitHub.
- Request-review and draft conversion remain deferred.
- Guest Mode never exposes write or review buttons (fixtures stay read-only).
- A Manager/Contributor who is neither author nor assignee can Approve but still cannot Open/Merge/Close/Reopen that Task’s PR.
