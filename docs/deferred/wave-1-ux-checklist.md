# Wave 1 — UX quick wins (checklists)

**Size:** mostly XS–S; **Projects without GitHub** = M (light own plan below)  
**Ship as:** independent small PRs in any order inside this wave. No ADR unless no-GH create flow needs SCHEMA.md clarification.

Prerequisites: Guest Mode optional except “Guest palette” (Wave 0 / 4). Prefer finishing Mentions polish / #159 first only for less conflict noise.

---

## 1. Palette: Navigate to Board / Git / CI / Settings — **S**

**Where:** [`src/features/command-palette/model/rules.ts`](../../src/features/command-palette/model/rules.ts), UI in `command-palette.tsx`.

Checklist:

- [x] Extend `CommandPaletteIntent` with navigate intents (or one `navigate` + path).
- [x] Visibility when `projectId` (and `boardId` where needed) present in URL context.
- [x] Select → TanStack Router navigate to existing TopBar section routes.
- [x] i18n + unit tests in `rules.test.ts`.
- [x] Remove/update Deferred palette row in SPEC when shipped.

Shipped: #170 (TopBar sections: Board / Backlog / CI/CD / Settings — Deferred “Git” label mapped to current tabs).

---

## 2. Palette: Separate Create bug / Create feature — **XS–S**

Checklist:

- [x] Add intents or cmdk items that call create with `type: "bug" | "feature"` (default today `task`).
- [x] Thread type through `createTaskIntent` / `useBoardTasks.createTask` / `createTaskRecord`.
- [x] Same column gate as Create Task (`resolveCreateTaskColumnGate`).
- [x] i18n + tests.

Shipped: #170.

---

## 3. Palette: Remember last Board per Project — **S**

Checklist:

- [x] Persist last `boardId` per `projectId` (`localStorage` via `safe-storage`).
- [x] Update on Board visit / switcher.
- [x] Switch Project navigates to last Board when known, else first Board (current behavior).
- [x] Tests for resolver pure function.

Shipped: #171.

---

## 4. Palette: Include archived Tasks in search — **S**

Checklist:

- [x] Today [`matchCommandPaletteTasks`](../../src/features/command-palette/model/rules.ts) skips `archivedAt` — add opt-in (toggle or “include archived” query token).
- [x] Results still cap 20; navigate opens Task (Board archive dialog semantics unchanged).
- [x] i18n + tests.

Shipped: #171.

---

## 5. Palette: Search Members — **S–M** (light)

Checklist:

- [x] Query Team members for current Team/Project context (`team_members` / existing teams hooks).
- [x] Match display name / username; select → Member settings or profile affordance already in app.
- [x] Hidden without Team context; capability: all roles that can see members.
- [x] i18n + tests.

Shipped: #172.

---

## 6. Header **+ New Task** board CTA — **XS–S**

Checklist:

- [x] Board chrome button (Manager+/canCreateTasks) opening create-on-first-column (reuse column create path).
- [x] Do **not** adopt Make dock IA (ADR 0007 / SPEC Make deferred).
- [x] i18n; focus ring; mobile `min-w-0` / truncate.

Shipped: #173.

---

## 7. Flat all-Projects home — **S–M** (light)

Checklist:

- [x] Home stays Teams-first; add optional “All projects” view or filter listing Projects across Teams user can access.
- [x] Read-only list → navigate `/projects/$projectId`.
- [x] No new membership model.
- [x] Update SPEC Deferred row when shipped.

Shipped: #174.

---

## 8. Projects without GitHub — **M** (own plan)

### Goal

Create name-only Project under Team without connecting a GitHub repo. Schema already allows null `github_*` ([`projects-api` types](../../src/features/projects/model/types.ts)).

### Slices

1. **Create UX** — extend Team projects flow / dialog: branch “Connect GitHub” vs “Name only” (Owner/Admin). Validate name/slug; `createProject` with null repo fields. ✅ (#175)
2. **Gate Git/CI** — TopBar tabs Git surfaces + CI/CD: empty state “Connect a repository” + deep-link to settings/connect; hide live Actions calls when no `github_repo_id`. (#176)
3. **Board/Kanban** — unaffected; branch/PR fields on tasks show soft empty states. (default board trigger covers Board/Backlog/Sprints; soft empties with #176)
4. **Connect later** — optional follow-up: attach repo to existing Project (unique `(team_id, github_repo_id)`); can be same PR or fast-follow. (#177)

### Acceptance

- [x] Can create and use Board/Backlog/Sprints without GitHub. (#175 — create + default board trigger; Git/CI surfaces gated in #176)
- [ ] No spurious GitHub API errors on CI/Git routes. (#176)
- [x] Duplicate-repo constraints unchanged for connected Projects.
- [ ] SPEC Deferred row cleared. (after #176 + #177)

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
