# Wave 1 — UX quick wins (checklists)

**Size:** mostly XS–S; **Projects without GitHub** = M (light own plan below)  
**Ship as:** independent small PRs in any order inside this wave. No ADR unless no-GH create flow needs SCHEMA.md clarification.

Prerequisites: Guest Mode optional except “Guest palette” (Wave 0 / 4). Prefer finishing Mentions polish / #159 first only for less conflict noise.

---

## 1. Palette: Navigate to Board / Git / CI / Settings — **S**

**Where:** [`src/features/command-palette/model/rules.ts`](../../src/features/command-palette/model/rules.ts), UI in `command-palette.tsx`.

Checklist:

- [ ] Extend `CommandPaletteIntent` with navigate intents (or one `navigate` + path).
- [ ] Visibility when `projectId` (and `boardId` where needed) present in URL context.
- [ ] Select → TanStack Router navigate to existing TopBar section routes.
- [ ] i18n + unit tests in `rules.test.ts`.
- [ ] Remove/update Deferred palette row in SPEC when shipped.

---

## 2. Palette: Separate Create bug / Create feature — **XS–S**

Checklist:

- [ ] Add intents or cmdk items that call create with `type: "bug" | "feature"` (default today `task`).
- [ ] Thread type through `createTaskIntent` / `useBoardTasks.createTask` / `createTaskRecord`.
- [ ] Same column gate as Create Task (`resolveCreateTaskColumnGate`).
- [ ] i18n + tests.

---

## 3. Palette: Remember last Board per Project — **S**

Checklist:

- [ ] Persist last `boardId` per `projectId` (`localStorage` via `safe-storage`).
- [ ] Update on Board visit / switcher.
- [ ] Switch Project navigates to last Board when known, else first Board (current behavior).
- [ ] Tests for resolver pure function.

---

## 4. Palette: Include archived Tasks in search — **S**

Checklist:

- [ ] Today [`matchCommandPaletteTasks`](../../src/features/command-palette/model/rules.ts) skips `archivedAt` — add opt-in (toggle or “include archived” query token).
- [ ] Results still cap 20; navigate opens Task (Board archive dialog semantics unchanged).
- [ ] i18n + tests.

---

## 5. Palette: Search Members — **S–M** (light)

Checklist:

- [ ] Query Team members for current Team/Project context (`team_members` / existing teams hooks).
- [ ] Match display name / username; select → Member settings or profile affordance already in app.
- [ ] Hidden without Team context; capability: all roles that can see members.
- [ ] i18n + tests.

---

## 6. Header **+ New Task** board CTA — **XS–S**

Checklist:

- [ ] Board chrome button (Manager+/canCreateTasks) opening create-on-first-column (reuse column create path).
- [ ] Do **not** adopt Make dock IA (ADR 0007 / SPEC Make deferred).
- [ ] i18n; focus ring; mobile `min-w-0` / truncate.

---

## 7. Flat all-Projects home — **S–M** (light)

Checklist:

- [ ] Home stays Teams-first; add optional “All projects” view or filter listing Projects across Teams user can access.
- [ ] Read-only list → navigate `/projects/$projectId`.
- [ ] No new membership model.
- [ ] Update SPEC Deferred row when shipped.

---

## 8. Projects without GitHub — **M** (own plan)

### Goal

Create name-only Project under Team without connecting a GitHub repo. Schema already allows null `github_*` ([`projects-api` types](../../src/features/projects/model/types.ts)).

### Slices

1. **Create UX** — extend Team projects flow / dialog: branch “Connect GitHub” vs “Name only” (Owner/Admin). Validate name/slug; `createProject` with null repo fields.
2. **Gate Git/CI** — TopBar tabs Git surfaces + CI/CD: empty state “Connect a repository” + deep-link to settings/connect; hide live Actions calls when no `github_repo_id`.
3. **Board/Kanban** — unaffected; branch/PR fields on tasks show soft empty states.
4. **Connect later** — optional follow-up: attach repo to existing Project (unique `(team_id, github_repo_id)`); can be same PR or fast-follow.

### Acceptance

- [ ] Can create and use Board/Backlog/Sprints without GitHub.
- [ ] No spurious GitHub API errors on CI/Git routes.
- [ ] Duplicate-repo constraints unchanged for connected Projects.
- [ ] SPEC Deferred row cleared.

### Key files

`add-project-dialog.tsx`, `projects-api.ts`, `use-projects.ts`, TopBar section tabs, `features/ci-cd` + `git-integration` entry routes.

---

## Skip (already decided)

| Item                                   | Verdict                            |
| -------------------------------------- | ---------------------------------- |
| Cmd+K in chrome                        | MVP TopBar — ignore Make placement |
| Make dock primary nav                  | Superseded by TopBar               |
| Drawer DIFF / commits as Make sections | Keep Git tab                       |
| Two-column Make drawer                 | ADR 0007 skin only                 |
