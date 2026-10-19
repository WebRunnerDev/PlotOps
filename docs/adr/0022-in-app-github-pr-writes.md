# In-app GitHub PR writes (Open + Merge + Close + Reopen + Approve + Request review)

PlotOps can **Open**, **Merge**, **Close**, **Reopen**, **Approve**, and **Request review** on pull requests from the task GitHub panel using the signed-in user’s GitHub `provider_token` (`repo` OAuth scope already requested at login).

## Decision

- **Client GitHub REST** — `POST /repos/{}/pulls`, `PUT /repos/{}/pulls/{}/merge`, `PATCH /repos/{}/pulls/{}` (close: `state=closed`; reopen: `state=open`), `POST /repos/{}/pulls/{}/reviews` (`APPROVE`), and `POST /repos/{}/pulls/{}/requested_reviewers` with the user’s token. The action attributes to that GitHub user (correct audit trail).
- **Not** GitHub App installation tokens for writes in this slice (App already used for webhooks only).
- **PlotOps Open / Merge / Close / Reopen gate** (before calling GitHub):
    - Guest / Viewer / archived task → hide write actions.
    - Owner / Admin → any task.
    - Manager / Contributor → only when `auth.uid` is task **author** or **assignee**.
- **PlotOps review gate (Approve + Request review)** — distinct from Open/Merge/Close/Reopen:
    - Guest / Viewer / archived task → hide Approve and Request review.
    - Owner / Admin / Manager / Contributor who can access the Project → Approve, or request review on, any open linked PR on that Project (**no** author/assignee restriction; reviewers are usually not the assignee).
    - GitHub still enforces whether that user may approve (an author can never approve their own PR, with or without branch protection — PlotOps surfaces that 422 as a dedicated toast) and whom they may ask to review.
- GitHub remains authoritative for repo rights; 401/403/422 → reconnect / forbidden / validation messaging.
- **Base** = Board base branch; **head** = task `branchName`. PR title default `` `${task.key}: ${task.title}` ``.
- Merge confirm dialog; default method **`squash`** (`merge` / `rebase` selectable).
- Close confirm dialog; sets local `pr_state` to `closed` without merging or moving the Task column.
- Reopen is offered only when the linked PR is `closed` (never `merged`); no confirm dialog (non-destructive). Sets local `pr_state` back to `open` without moving the Task column, so Merge/Close/Approve become available again. GitHub may still refuse (e.g. head branch deleted → 422 validation message).
- Approve has a confirm dialog (the review is posted publicly under the user's name); success toast only. Does **not** change Task column or local `pr_state` (stays `open` unless GitHub/webhook says otherwise).
- Request review opens a picker: repo collaborators (`GET /repos/{}/collaborators`) plus a free-typed GitHub login, since GitHub only lists collaborators to users with push access. The PR author and already-requested logins are ruled out in the picker; at least one reviewer is required. Success toast only — does **not** Approve, Merge, move the Task column, or change local `pr_state`. GitHub’s 422 is split by its message into “PR author” vs “not a valid reviewer”, and a rate-limited 403 is reported as a rate limit rather than a permission error.
- On merge success, update local `pr_state` only. **`github-webhook`** remains source of truth for moving the Task to the Board’s last column when the PR merges into that Board’s base branch.

## Consequences

- Users signed in with email-only (no `provider_token`) cannot Open/Merge/Close/Reopen/Approve/Request review until they reconnect with GitHub.
- Team reviewers (`team_reviewers`) and draft conversion remain deferred.
- Guest Mode never exposes write or review buttons (fixtures stay read-only).
- A Manager/Contributor who is neither author nor assignee can Approve and Request review but still cannot Open/Merge/Close/Reopen that Task’s PR.
