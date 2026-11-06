# Multi-repo Projects

A Project used to hold at most one GitHub repository (`projects.github_repo_id` / `github_full_name` / `github_default_branch`). A Task held at most one branch and PR (`tasks.branch_name` / `pr_number` / `pr_url` / `pr_state`), and those columns did not say which repository they belonged to. Teams that keep the frontend and the backend in separate repositories therefore needed two Projects. That gave them two Boards, no shared Sprints, no cross-repo Epics and no Task Links between the halves of one feature. Team Tasks only lists Tasks; it is not a Board.

## Decision

- **A Project holds 0..N Repositories** in `project_repositories (project_id, github_repo_id, github_full_name, github_html_url, github_default_branch)`.
    - `unique (team_id, github_repo_id)` moves here from `projects`. A repository belongs to at most one Project in a Team, so a webhook delivery resolves to exactly one Project.
    - **Repository cap: 5 per Project**, enforced by a `BEFORE INSERT` trigger (`project_repositories_cap()`). It raises `P0001` with a hint, following ADR 0032. The app mirrors the cap. Guest Mode is not capped.
    - **There is no primary Repository.** All Repositories are equal. Pickers default to the last Repository this viewer chose on this Board, and they skip the choice when the Project has one Repository.
- **A Task holds at most one Git link per Repository** in `task_git_links (task_id, repository_id, branch_name, pr_number, pr_url, pr_state)`, with `unique (task_id, repository_id)`. A full-stack Task can carry one frontend PR and one backend PR.
- **Base branch is per Board × Repository** in `board_repositories (board_id, repository_id, base_branch)`. One row exists for every Development Board and every Repository in its Project. A row is seeded from the Repository's default branch when either side is created: a Repository added to the Project, or a Board turned into a Development Board. Rows are cleared when the Board stops being a Development Board.
    - **Allowed head patterns stay on the Board** and apply to every Repository. They express the team's branch-naming convention, not a property of a Repository.
- **The webhook resolves Repository first.** It looks up `project_repositories` by `github_repo_id`, which yields the Project. It then finds the Task in this order: `(repository_id, pr_number)`, then `(repository_id, branch)`, then `task_key` in the head ref.
    - Matching on `pr_number` alone is wrong once PR numbers from different Repositories coexist.
- **Auto-link.** When a GitHub event matches a Task only by its task key and the Task has no Git link for that Repository, the Git link is created automatically (#351).
    - The key is found anywhere in the head branch, the PR title or the PR body, case-insensitively. The app and the Edge Functions share one extractor (`supabase/functions/_shared/task-key.ts`).
    - A PR naming several keys links to each of those Tasks.
    - A pushed branch (`create` event) with a key creates a branch-only Git link. A PR opened from it later joins that link.
    - Backfill: the drawer's refresh button and connecting a Repository run the `github-backfill` Edge Function. It reads the open PRs and branches through the GitHub App and applies the same rules.
    - It never overwrites an existing Git link for that Repository. A different PR is logged as `link_conflict`.
    - A manual unlink is remembered (`task_git_link_dismissals`, per Task × Repository × branch / PR). Auto-link never brings that branch or PR back to the Task. Linking it again by hand lifts the dismissal.
    - Activity marks the change as linked automatically by key (`metadata.auto_link.key`).
    - Still one Git link per Task per Repository. Several links per Repository would need a separate decision.
- **Merge sync waits for all PRs.** A Task moves to its Board's merge target column (ADR 0033) only when every one of its Git links that has a PR is merged into that Board's Base branch for that Repository. Specifically:
    - A PR closed without merge does not count.
    - A Git link with a branch but no PR does not count.
    - A PR merged into a branch other than the Base branch is **pending**, as `wrong_base` was before. The Task waits.
    - Idempotency and the activity and notification rules from ADR 0033 are unchanged. They apply to the last merge that completes the set.
- **Board move keeps Git links.** After the move, merge sync compares against the destination Board's Base branch for each Repository.
- **Unlinking a Repository** is Admin+, the same permission as linking one.
    - It asks for confirmation and shows how many Tasks hold Git links to that Repository.
    - It then deletes those Git links and writes an `activity_log` row on each affected Task.
    - Nothing on GitHub is touched.
- **GitHub App status per Repository.** Project Settings → Repositories shows whether the GitHub App is installed on each Repository, using the installation API, and links to the install page. The lookup runs in the `github-app-status` Edge Function, because it needs an App JWT that must stay server-side; when it fails, the page shows the status as unavailable and keeps working. Without the App, the webhook stays silent for that Repository and merge sync would wait forever.
- **UI**
    - **Create Project** accepts several Repositories at once, up to the cap. More can be added later in Project Settings.
    - **Kanban card** shows one aggregate PR badge, for example "2 PR · 1 merged", with a per-Repository breakdown in the tooltip. A Task with a single Git link looks exactly as before.
    - **Task drawer** groups Git links by Repository. Create branch / PR offers only the Repositories the Task has no Git link for yet.
    - **CI/CD** shows one feed of workflow runs across all Repositories, with a Repo column and a Repo filter. The column is hidden when the Project has one Repository.
- **Guest Mode** gets a "Web + API" demo Project with two Repositories and at least one Task that has a PR in each, served by `fixture-git-api.ts`.
- **Migration.** One transaction does the following:
    1. Copy `projects.github_*` into `project_repositories`, `tasks.branch_name/pr_*` into `task_git_links`, and `boards.base_branch` into `board_repositories`.
    2. Compare row counts against the source rows and `RAISE EXCEPTION` on any mismatch, which rolls the whole transaction back.
    3. Drop the old columns.

    Generated types are regenerated in the same change. Take a production backup before deploy. CI already rehearses migrations (ADR 0016).

## Rejected

- **Two Projects plus Team Tasks.** The halves of one feature cannot share a Board, a Sprint, an Epic or a blocks link.
- **One Repository per Board.** Boards would split by repository again, which is the problem this ADR exists to solve.
- **One Git link per Task, carrying a `repository_id`.** Full-stack work would have to be broken into separate Tasks or Subtasks just to hold two PRs.
- **Unbounded Git links per Repository.** Several branches of one Repository on one Task make "all merged" ambiguous, and the badge unreadable.
- **A single Base branch name applied to every Repository.** It breaks as soon as repositories use different defaults, for example `main` and `develop`.
- **Move the Task on the first merge.** This brings back the premature-close behaviour that ADR 0033 removed.
- **Counting branch-only Git links as pending.** A forgotten branch would hold a finished Task open forever.
- **Blocking Repository unlink while PRs are open.** Unlinking loses no GitHub data, and the block would strand a Project whose repository was archived or moved.
- **Keeping the old columns as deprecated for a release.** There are no external schema clients, and two sources of truth for the webhook are riskier than one atomic cutover.
