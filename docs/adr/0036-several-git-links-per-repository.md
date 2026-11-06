# Several Git links per Task per Repository

ADR 0035 allowed one Git link per Task per Repository: one branch and one PR. In practice a Task often has several PRs in one Repository: the fix, a hotfix, a follow-up. Auto-link (#351) logged the second one as `link_conflict` and dropped it, and the drawer could only replace the first link, not add another. Jira shows every branch and PR that carries the task key, from any number of repositories.

This ADR replaces the ADR 0035 rule "a Task holds at most one Git link per Repository" (#352). The rest of ADR 0035 stands.

## Decision

- **A Task holds any number of Git links per Repository.** `task_git_links` drops `unique (task_id, repository_id)`. Instead:
    - `unique (task_id, repository_id, pr_number)`: a Task holds a PR once. Rows without a PR do not collide (`NULL`s are distinct).
    - A partial unique index on `(task_id, repository_id, branch_name) where pr_number is null`: a branch-only Git link appears once.
    - The same branch may appear on several Git links. A second PR opened from an already linked branch gets its own Git link.
    - Uniqueness stays per Task, not per Repository. A PR naming several task keys still links to each of those Tasks (#351).
    - No cap. The card badge aggregates any number of PRs, and the drawer lists one row per Git link.
- **Migration.** Existing rows already satisfy the new constraints, so no data moves. The migration swaps the constraints and checks that the row count is unchanged, in one transaction. Verified locally with `supabase db reset` and pgTAP. Preview deployments read the production database and do not show the new schema.
- **`update_task_details` addresses a Git link by `git_link_id`.**
    - An id the Task already holds updates that row. Its Repository comes from the row.
    - An id the Task does not hold yet adds a Git link with that id. The app picks the id (`crypto.randomUUID()`), so the optimistic row, the server row and an Undo after unlink all share it.
    - Without `git_link_id`, the call behaves as before while the Task has at most one Git link in that Repository. With several, it raises `22023` ("git_link_id is required").
    - A Git link left with neither branch nor PR is still removed.
- **Webhook.** Candidates carry every Git link of the Task in the delivering Repository. The match order stays `(repository, pr_number)`, then `(repository, branch)`, then the task key. The binding is:
    - `linked`: a Git link already holds this PR (or, for `create`, this branch). That row is updated. A repeated event never creates a duplicate.
    - `bind`: a branch-only Git link on the PR's head branch takes the PR.
    - `auto_link`: no Git link holds this PR or branch yet, so a new one is added. This also covers a second PR from an already linked branch.
    - `dismissed`: unchanged. A person unlinked this branch or PR from the Task, and auto-link never brings it back.
    - `link_conflict` no longer exists.
    - Concurrent deliveries for the same PR meet at the unique constraint: the upsert on `(task_id, repository_id, pr_number)` updates the existing row, and a duplicate branch-only insert is ignored.
- **Merge sync** counts every Git link of the Task across all Repositories. The ADR 0035 rules are unchanged:
    - A PR closed without merge does not count. Neither does a branch-only Git link.
    - A PR merged outside the Board's Base branch keeps the Task waiting.
    - The Task moves when every counted PR is merged. The event that completes the set carries the status change and the notifications.
    - **Excluding a PR** that should not hold the Task (forgotten, opened by mistake, or one that only mentions the key) means unlinking it. The unlink is remembered (`task_git_link_dismissals`), so auto-link does not bring it back. There is no separate "exclude from merge sync" flag.
- **UI**
    - **Drawer**: one row per Git link, in Project order, then oldest first. Rows are keyed and written by Git link id.
    - "+ Link → Branch" always adds a new Git link. It refuses a branch this Repository already holds for the Task.
    - "+ Link → PR" refuses a PR the Task already holds in that Repository. A PR whose head is a branch-only Git link joins that link. Any other PR adds a new link.
    - **Generate branch** fills the "+ Link → Branch" form, so it creates a new Git link.
    - **Open PR** stays on each row and opens a PR from that row's branch.
    - Commits and the Git tab follow the newest Git link of each Repository.
    - **Kanban card**: the aggregate badge counts every PR, for example "3 PR · 2 merged". A Task with a single Git link looks exactly as before.
    - **Repository unlink** counts affected Tasks, not rows. It writes one `activity_log` row per removed Git link.
- **MCP** `get_task` returns `git_links[]` with `id` and `created_at`, one entry per Git link. The MCP tools still do not write Git links, so nothing changes in the GRANTs (#337).
- **Guest Mode** mirrors `update_task_details`, including addressing by id, the duplicate refusals and the `git_link_id is required` error. Links saved without an id get one when read. The "Web + API" demo has FEAT-1 with two PRs in the web Repository: the feature, which is open, and a merged hotfix.

## Rejected

- **Uniqueness per Repository: `(repository, pr_number)` / `(repository, branch_name)`.** One PR could no longer link to the several Tasks it names (#351).
- **Unique branch per Task × Repository.** A second PR from the same branch, such as a reopen-as-new or a follow-up, would have nowhere to go.
- **An "exclude from merge sync" flag on a Git link.** Unlinking already removes the PR from the set and is remembered, so a second mechanism would show a PR that does not count.
- **Counting closed-unmerged PRs as pending.** A PR abandoned in favour of another would hold the Task open forever. This rule is unchanged from ADR 0035.
- **A cap on Git links per Task.** No observed need. The badge and the drawer handle any count.
- **Server-generated ids with a refetch before further writes.** A row linked a moment ago could not be changed or undone until the refetch landed. A client-chosen id avoids that.
