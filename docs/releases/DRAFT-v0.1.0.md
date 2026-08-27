# v0.1.0 — First public snapshot

> **Draft** — publish only after merging committed `dev` → `main` and CI is green.
> Do **not** include the current uncommitted WIP (auth boot gating, tasks realtime invalidation, etc.) unless those land in the same merge.

**Suggested tag:** `v0.1.0`  
**Suggested title:** `v0.1.0 — First public snapshot`  
**Why 0.1.0 not 1.0.0:** first tag ever; deeper Git polish still in progress per SPEC; keeps room for breaking schema/UX before calling it “1.0”.

---

Paste below into GitHub Release body:

```markdown
## Highlights

First tagged release of PlotOps — a git-native project tracker with Kanban, sprints, in-app GitHub PRs/diffs, and a real GitHub Actions CI/CD dashboard. Sign in with GitHub or Google, or try the local Guest demo.

## What's Changed

### Added

- GitHub + Google OAuth, email signup, and local Guest Mode sandbox
- Teams above Projects with roles, invites, and gated Git/CI empty states
- Multi-board Kanban (custom columns, labels, priority, deadlines, filters, archive)
- Subtasks as full tasks, Task Links (`blocks` / `relates`), and Done-gating
- Board-scoped Sprints: Backlog, Start/Close/Cancel, estimates, burndown, insights
- Task rich text (TipTap): images, tables, mentions
- In-app Git: branch link, PR open/merge, code diff, smart commit discovery, PR check runs
- CI/CD dashboard backed by GitHub Actions (filters, jobs, logs, infinite scroll)
- Command palette (Ctrl/Cmd+K) for search, create, and navigation
- Project custom text fields (Settings CRUD + drawer; built-in Description)
- Watch/assignment notifications and activity feed
- GitHub webhook: PR merge → move task to Done column

### Changed

- Compact board toolbar and clearer board switcher placement
- Hide-completed toggle on board and backlog; priority rail on cards
- Solo teams can auto-assign new tasks to the creator

### Fixed

- Kanban drop targeting on empty columns
- False-positive commit matches when linking by task key
- Non-GitHub provider tokens no longer break Git API calls

## Upgrade notes

- First public tag — no previous release to migrate from.
- Schema changes ship via committed migrations; CI applies them to PlotOps remote on `main`.
- Operators still need `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, GitHub App / webhook secrets as documented in `docs/github-webhook-setup.md` and `docs/SUPABASE.md`.

## Full Changelog

Initial release. Browse history from the repo root, or after the next tag use:
`https://github.com/WebRunnerDev/PlotOps/compare/v0.1.0...vNEXT`
```

---

## How to publish (after merge)

```bash
# on main, clean tree, CI green
git pull origin main
git tag -a v0.1.0 -m "v0.1.0 — First public snapshot"
git push origin v0.1.0

gh release create v0.1.0 \
  --title "v0.1.0 — First public snapshot" \
  --notes-file docs/releases/DRAFT-v0.1.0.md
```

Or: GitHub → Releases → Draft a release → tag `v0.1.0` → paste the markdown body (the fenced block above, without the outer fences).

## Next releases (examples)

| When                                        | Version  | Theme          |
| ------------------------------------------- | -------- | -------------- |
| Auth remount + realtime board sync land     | `v0.1.1` | patch / polish |
| Approve / request-review on PRs, deeper Git | `v0.2.0` | minor          |
| Intentional breaking schema or public API   | `v1.0.0` | major          |
