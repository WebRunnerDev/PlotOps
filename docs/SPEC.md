# PlotOps — Product & Technical Specification

> Git-native project tracker (Linear/Jira-style) with GitHub integration.
> Source of truth: this file + [Notion page](https://app.notion.com/p/39773411f401806b85b3d072b7bff6d9).

## Progress

> **Maintainers:** update this section when a roadmap item or stage is done. Agents: update after completing a feature in the same change set.

| Area                                                   | Status                                                                                                                                                                                                                                                                                                                              |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Project scaffold (Vite, FSD, ESLint)                   | ✅ Done                                                                                                                                                                                                                                                                                                                             |
| Routing (TanStack Router)                              | ✅ Done                                                                                                                                                                                                                                                                                                                             |
| i18n (i18next)                                         | ✅ Done                                                                                                                                                                                                                                                                                                                             |
| Auth (Supabase, GitHub OAuth + email signup/confirm)   | ✅ Done                                                                                                                                                                                                                                                                                                                             |
| Guest mode                                             | 🟡 In progress — local Guest Mode (ADR 0018 / #161); remote shared demo login retired (#167) — plan: [`docs/deferred/wave-0-guest-mode.md`](deferred/wave-0-guest-mode.md)                                                                                                                                                          |
| Database schema + RLS (`projects`)                     | ✅ Done                                                                                                                                                                                                                                                                                                                             |
| GitHub project import (home page)                      | ✅ Done                                                                                                                                                                                                                                                                                                                             |
| Kanban board                                           | ✅ Done (custom columns, labels/priority/deadline; board filters; comments; soft-archive + board archive dialog; Make skin pass on board/cards/drawer — ADR 0007; DnD polish deferred)                                                                                                                                              |
| Task rich text + media (Storage)                       | ✅ Done (TipTap description editor; image upload via drag/paste/slash → `task-media` bucket)                                                                                                                                                                                                                                        |
| Task activity feed (`activity_log`)                    | ✅ Done (collapsible drawer section; app-level batched writes; Query on expand)                                                                                                                                                                                                                                                     |
| Git integration (PR, diff, branches)                   | 🟡 In progress (Git tab; branch generate/link/skip; link PR; in-app code diff viewer)                                                                                                                                                                                                                                               |
| CI/CD dashboard (mock UI)                              | ✅ Done (route + mock builds per branch; simulated streaming logs via `features/ci-cd` seam)                                                                                                                                                                                                                                        |
| CI/CD — real GitHub Actions                            | ✅ Done (Actions REST behind `buildsProvider`; Linear-style summary/filters/runs list; jobs + logs dialog; polling while in-flight)                                                                                                                                                                                                 |
| Command palette                                        | ✅ Done (Ctrl/Cmd+K + TopBar; rules seam; search Tasks; Create Task; Switch Project; Toggle theme — #21–#26)                                                                                                                                                                                                                        |
| GitHub webhooks + Edge Function                        | ✅ Done (`github-webhook`: PR merge → Task last column on Board Base branch; GitHub App + HMAC; does **not** feed CI/CD — see `docs/github-webhook-setup.md`)                                                                                                                                                                       |
| Team & permissions (`project_members`, roles, invites) | ✅ Done (Project-boundary MVP); 🟡 Team above Project — domain locked ADR 0017; schema+RLS #155 done (local); Team settings #157 + invite redeem #158 done (local); UI gating #160 done; Home Teams shell #156 done (local); create Project under Team (GH connect) done (local); lifecycle remainder #159 (delete empty Team) open |
| Multi-board + branch mapping                           | ✅ Done (ADR 0006; Boards under Project; Base branch + Allowed patterns; soft warn)                                                                                                                                                                                                                                                 |
| Sprints (Board-scoped)                                 | ✅ Done (ADR 0008; schema+RPCs; Backlog UI; Start/Close/Cancel; board scope; report; owned by `features/sprints` — ADR 0009 / #5)                                                                                                                                                                                                   |
| Feature modules (ADR 0009)                             | ✅ Done (`features/labels` #4; `features/sprints` #5; `features/boards` #6; slim tasks + composition root #7 — no BoardProvider)                                                                                                                                                                                                    |
| Top bar                                                | ✅ Done (logo→/home, Team→Project breadcrumbs, project section tabs Board/Backlog/CI/CD/Settings, avatar menu; compact board-local toolbar)                                                                                                                                                                                         |
| Notifications (Watch + assignment)                     | ✅ Done (MVP + structural expansion #35–#39)                                                                                                                                                                                                                                                                                        |
| Mentions (Description + Comment → always-on)           | 🟡 Schema + RPC (#41) + editor/extract (#42) + inbox/deep-link (#43) done; polish/verify as needed                                                                                                                                                                                                                                  |

## Notifications (MVP → structural expansion)

> Domain glossary: `CONTEXT.md` (Awareness + Priority). Decisions: `docs/adr/0010-notifications-fan-out.md`, `0011-expanded-structural-notifications.md`, `0012-auto-unwatch-without-stake.md`, `0013-board-move-notification-coalesce.md`. Mentions: ADR 0014 (section below).

### Model

- **Watch** is a per-Task personal subscription for a **curated set of structural** Task events (not every Activity).
    - Watcher kinds: **status change**, **Board move**, **Priority change**, **Assignee set/reassign**, **Author change**.
    - Not Watcher kinds: clear Assignee, title/description, Labels, Sprint membership, git fields, archive/restore, comments. Mentions are **not** Watcher kinds (always-on — see Mentions).
    - `Author` is auto-enrolled as Watcher on create and when set via transfer; may Unwatch.
    - `Assignee` is auto-enrolled as Watcher when set; may Unwatch.
    - Mentionees are **not** auto-enrolled as Watchers.
    - **Auto-Unwatch (ADR 0012):** after Author transfer or Assignee clear/reassign, remove that user's Watch only if they are **neither** Author **nor** Assignee. Manual Watchers without those roles keep Watch.
- **Notification** is an in-app inbox row addressed to one user about a Task event.
    - **Always-on:** assignment → new Assignee; **Assignee reassign → previous Assignee** (`assignee_change`); Author transfer → new Author; **Mention → Mentionee** (independent of Watch).
    - **Watchers** also get person-field kinds; **one row per recipient per change** if always-on and Watcher would both apply (dedupe).
    - **Board move (ADR 0013):** one `board_move` Notification including remapped status — no separate `status_change` for that remap. Same-Board column move → `status_change` only.
    - **Multi-field save:** one Notification **per changed kind** (not one summary row).
- **Self-notify is excluded**: never create Notifications for the actor of the change.
    - For GitHub webhook (automated, `user_id=null`), notify all Watchers of status change as today.
- **Free-tier posture (ADR 0011):** keep fan-out + Realtime; control volume via curated kinds, coalesce, dedupe, retention — no mute-per-kind or digest in this expansion.

## Mentions (Description + Comment)

> Domain glossary: `CONTEXT.md` (Mention, Mentionee, Notification, Watch). Decision: `docs/adr/0014-mentions-always-on-structured.md`.

### Model

- **Mention** is a structured rich-text reference to a single Project Owner or Member (including Viewer), keyed by user id — inside Task **Description** or **Comment**.
- Free-text `@Name` without a structured node is **not** a Mention. Group Mentions (`@everyone`, whole Roles) are out of scope.
- **Always-on Notification** kind `mention` to each newly added Mentionee on create/edit (diff vs previous body). Unchanged Mentionees are not re-notified. Same Mentionee twice in one save → one row. Actor (including self-Mention) is never notified.
- Does **not** auto-enroll Watch. Does **not** make plain Comments a Notification kind.
- Mentionee who left the Project: body may keep a stale Mention for display; further edits must **not** notify until they are Owner/Member again; existing inbox rows are not purged.
- Opening a `mention` Notification opens the Task; Comment Mentions also target that Comment (`commentId` in metadata). Metadata includes `source: "description" | "comment"`, actor, and optional `commentId`.

### Fan-out

- App extracts Mentionee ids from the saved body, computes new-only vs previous body, calls an RPC.
- RPC validates each Mentionee is a current Project Owner or Member, excludes the actor, inserts fan-out rows. No Postgres HTML-parse trigger.

### UI

- `@` suggestion picker in Description and Comment editors: current Project Owner + Members only.
- Stale Mentions render without resolving to a current Member (label snapshot / unknown).
- Inbox + bell: kind-specific copy for `mention`; search expansion includes mention terms (en/ru) like other kinds.

### Implementation plan

1. **Schema + RPC** — widen `notifications.kind` with `mention`; RPC for always-on mention fan-out (validate membership, exclude actor, accept mentionee id set + source metadata). (#41) ✅
2. **Editor + extract** — TipTap Mention node + `@` picker; pure helpers to extract Mentionee ids and compute new-only delta; wire Description + Comment save → RPC. (#42) ✅
3. **Inbox + deep link** — format/i18n/search for `mention`; open Task from Notification; Comment Mentions scroll/highlight that Comment. (#43) ✅

### Storage + fan-out

- Notifications are **fan-out rows** inserted at write time (instead of deriving the inbox from `activity_log`).
- Retention:
    - **Unread** notifications are kept up to **90 days**, then deleted.
    - **Read** notifications may be purged after **30 days**.
- Cleanup: the `/notifications` page (and the bell preview) performs best-effort cleanup for the current user via `cleanup_notifications_for_user()` before reading the list.

### UI

- **Bell** in `TopBar` opens a **Drawer preview** (“шторка”) with the latest unread-first notifications (soft cap ~20).
    - Clicking a notification marks it read and opens the corresponding Task drawer.
    - “Mark all read” marks all notifications in the current scope as read.
- **Full page**: `/notifications`
    - Global inbox with optional Project filter.
    - Search `q` by Task key/title (and show kind-specific context).
    - Pagination via query params (`limit` + `offset`).
- Kind-specific context copy must cover all Watcher + always-on kinds above.

### Realtime

- Subscribe (Realtime) to `notifications` changes for the current user (`recipient_id = auth.uid()`), primarily to refresh unread badge + drawer contents.

### Implementation plan (structural expansion)

1. **Schema + RPC primitives** — widen `notifications.kind`; Watcher fan-out by kind; Author always-on helper; auto-Unwatch when neither Author nor Assignee; prefer one round-trip that can insert multiple kinds for one Task save. ✅ (#35)
2. **Priority** — fan-out on Priority change to Watchers; inbox formatting + i18n. ✅ (#36)
3. **Board move** — fan-out `board_move` (coalesce status); stop double `status_change` on cross-Board moves; inbox formatting + i18n. ✅ (#37)
4. **Assignee** — Watchers get set/reassign; keep always-on to new Assignee with dedupe; always-on `assignee_change` to previous Assignee on reassign; auto-Unwatch previous when no remaining stake. ✅ (#38)
5. **Author** — always-on to new Author + Watchers; auto-enroll Watch on new Author; auto-Unwatch previous when no remaining stake; inbox formatting + i18n. ✅ (#39)

MVP baseline (already shipped): `task_watchers`, status + assignment RPCs, app + webhook fan-out paths, bell + `/notifications`, Watchers list.

## Sprints (MVP)

> Domain glossary: `CONTEXT.md` (Planning). Decision: `docs/adr/0008`.

**Model:** Sprint ⊆ Board. States: `draft` → `active` → `closed` | `canceled`. ≤1 Active per Board; many Drafts. Backlog = Tasks with no `sprint_id`. Start → Commitment snapshot; Active add/remove → Scope change events. Close → user confirms completed (recommend last column) + Carryover incomplete to Backlog or a Draft. Cancel → all Tasks to Backlog (canceled sprints appear in Backlog **Sprint history**). Manager+ may permanently delete closed/canceled history (and cascaded `sprint_events`) for free-tier hygiene. Dates required at Start. Manager+ plans; Contributor views. Kanban toggle: Active sprint | Entire board. No points/KPI/burndown in MVP.

### Implementation plan

1. **Schema + RLS** — `sprints`, `sprint_events`, `tasks.sprint_id`; unique Active per Board; clear `sprint_id` on archive / board move (+ scope event when leaving Active).
2. **API + hooks** — CRUD Draft, assign/reorder, Start / Close / Cancel, report reads; `canManageBoard` for mutations.
3. **Backlog route** — `/projects/$projectId/boards/$boardId/backlog`: Draft/Active sections + Backlog; DnD membership (Manager+).
4. **Lifecycle dialogs** — Start (dates, default 14d), Close (completed checkboxes + carryover), Cancel confirm; Sprint report for Closed.
5. **Board chrome** — link to Backlog; scope toggle Active sprint | Entire board; optional sprint badge on cards.
6. **Progress** — mark Done when the slice above ships. ✅

## Team & permissions (MVP → Team above Project)

> Domain glossary: `CONTEXT.md`. Decisions: `docs/adr/0001`–`0005` (Project-boundary MVP, partly superseded), **ADR 0017** (Team above Project).

### Shipped (Project-boundary MVP)

Project was the collaboration boundary. Owner = `projects.owner_id`. Members: Admin / Manager / Contributor / Viewer via `project_members` / `project_invites`. Invites email-addressed, copy-link, TTL 1/7/30/never. Settings + `/invite/$token` + `useProjectAccess` UI gating.

### Target model (ADR 0017)

**Team** is the access and ownership boundary (`teams.owner_id`, `team_members`, `team_invites`). Every Project belongs to exactly one Team; no Project membership overlay and no `projects.owner_id`. Roles unchanged — same capabilities apply to all Projects in the Team. Create Project: Owner/Admin (still by connecting a GitHub repo). Delete Project: Owner only. Delete Team: only when it has zero Projects. Team-first UX: Home = Teams; empty Team allowed; Members/Invites in Team settings; Board URLs stay `/projects/$projectId/boards/$boardId`. Data migration: **1:1** each existing Project → its own Team (members/invites lifted); unique `(team_id, github_repo_id)`.

### Implementation plan (Team above Project)

1. **Domain lock** — CONTEXT + ADR 0017 + this SPEC section (docs). ✅
2. **Schema + RLS** — `teams`, `team_members`, `team_invites`, `projects.team_id`; 1:1 backfill; drop `project_members` / `project_invites` / `projects.owner_id`; capability helpers + policies on Team. ✅ (#155)
3. **Home / Team shell** — list Teams, create Team, Team projects list. ✅ (#156)
4. **Team settings** — members, invites, leave/remove, Owner transfer (lifted semantics). ✅ (#157)
5. **Invite redeem** — `/invite/$token` joins a Team. ✅ (#158)
6. **Project lifecycle** — create under Team (GH connect) ✅; delete Project (Owner) ✅ via card; delete empty Team ⬜ (#159)
7. **UI gating** — `useTeamAccess` for Board/Git/settings controls (RLS remains source of truth). ✅ (#160; create-under-Team affordance on Team projects page)

## Deferred / later

> Captured during domain grilling (Team & Permissions + Team above Project). Not in current scope — do not implement until explicitly pulled in.
>
> **Roadmap (order, size, nested plans):** [`docs/deferred/`](deferred/README.md) — Wave 0 Guest Mode → Wave 1 UX → Wave 2 invites → Wave 3 sprints → Waves 4+ on explicit pull only.

| Item                                 | Notes                                                                                                                                  |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------- |
| Projects without GitHub              | Schema already allows null repo fields; create stays “connect GitHub repo”. Name-only Project later.                                   |
| Flat all-Projects home               | Home is Teams-first; a cross-Team Projects view can wait.                                                                              |
| Merge / move Projects between Teams  | 1:1 migration only; no Team merge or Project transfer UI in this slice.                                                                |
| GitHub collaborator auto-suggest     | On repo connect, list GH collaborators and offer “Add to Team”.                                                                        |
| Custom SMTP / real invite emails     | Invite model stays email-addressed; wire Resend (or similar) when free-tier mail is not enough.                                        |
| Open invite link (no email binding)  | Role + TTL link anyone can redeem — separate from email-targeted Invites.                                                              |
| Board-level permission overrides     | Notion `view` / `edit` / `manage` per board beyond Team Role.                                                                          |
| Assigned-only Contributor edits      | Rejected for MVP (Contributor may update any Task); revisit if needed.                                                                 |
| Granular permission flags per Member | Roles only for MVP; no custom `tasks:create`-style flags.                                                                              |
| Story points / estimates on Tasks    | Sprint metrics are count-based for MVP (`CONTEXT.md`).                                                                                 |
| Sprint burndown chart                | Optional in Notion; defer until points or richer time series exist.                                                                    |
| Column `is_done` flag                | Close recommends last column only; revisit if Done columns move left often.                                                            |
| Per-task carryover targets on Close  | MVP: one target for all incomplete (Backlog or chosen Draft).                                                                          |
| Sprint KPI / velocity dashboards     | Corporate metrics deferred with points.                                                                                                |
| In-app PR merge / approve / open PR  | Merge (and other write PR actions) stay on GitHub; PlotOps views + webhook sync only. Revisit later if product wants GitHub write API. |
| Group Mentions (`@everyone` / Roles) | Mentions MVP is single-user only (ADR 0014).                                                                                           |
| Comment events without Mention       | Plain Comments stay out of Notifications; only Mentions fan out.                                                                       |

### Ideas to revisit (Command Palette)

> Captured during Command Palette grilling. Not committed backlog — revisit before expanding the MVP set. Checklists: [`docs/deferred/wave-1-ux-checklist.md`](deferred/wave-1-ux-checklist.md) (Guest palette: Wave 0 / [`wave-4-plus-later.md`](deferred/wave-4-plus-later.md)).

| Idea                                                 | Notes                                                                           |
| ---------------------------------------------------- | ------------------------------------------------------------------------------- |
| Navigate to Board / Git / CI / Settings from palette | Beyond MVP actions; would turn palette into fuller launcher                     |
| Separate Create bug / Create feature commands        | MVP creates Task with default type `task`; user changes type in drawer          |
| Search Members                                       | Cross-cutting; not in MVP                                                       |
| Search Task description / Labels                     | MVP is key + title only                                                         |
| Remember last visited Board per Project              | MVP Switch Project uses project index → first Board                             |
| Include archived Tasks in search                     | MVP excludes archive; archive UI remains on Board                               |
| Guest-specific palette behaviour                     | Guest mode not started; palette rides authenticated MainLayout when Guest ships |

## Deferred from Figma Make

> Visual redesign source: Dark-themed CRM Interface Design. Policy: ADR 0007 — skin only; keep existing feature structure. Rows below are Make UI/ideas with **no** matching PlotOps feature yet — do not implement in the redesign pass. Parked chrome ideas: [`docs/deferred/wave-4-plus-later.md`](deferred/wave-4-plus-later.md) § Parked. Board **+ New Task** CTA checklist: [`wave-1-ux-checklist.md`](deferred/wave-1-ux-checklist.md).

| Item                                                                                 | Notes                                                                                                                                          |
| ------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Command palette entry in chrome (`⌘K` button)                                        | Product Cmd+K + TopBar button are MVP (see §4); Make placement was board-header-only — we use global TopBar.                                   |
| **Group by** board control                                                           | Not in PlotOps; Make-only.                                                                                                                     |
| **Display** board control                                                            | Not in PlotOps; Make-only.                                                                                                                     |
| Make dock primary nav: **Board / CI/CD / Branches / Settings** + member avatar stack | Bottom dock removed — project sections live as center tabs in `TopBar` (Board / Backlog / CI/CD / Settings). Branches not a top-level section. |
| Header **+ New Task** as primary CTA                                                 | We add tasks per column; optional later if we want a board-level create entry.                                                                 |
| Make Task drawer **two-column** layout (content + meta sidebar)                      | Visual reference only — keep current drawer sections/fields (ADR 0007).                                                                        |
| Drawer **DIFF PREVIEW** / **RECENT COMMITS** as first-class Make sections            | Git/diff already live under existing Git tab / panels; do not restructure drawer around Make sections.                                         |

## Tech Stack

| Layer        | Choice                                                         |
| ------------ | -------------------------------------------------------------- |
| Build        | Vite 8                                                         |
| UI           | React 19, Tailwind CSS 4, shadcn/ui                            |
| Routing      | TanStack Router                                                |
| Server state | TanStack Query                                                 |
| UI state     | Zustand (when local `useState` is not enough)                  |
| i18n         | i18next + react-i18next                                        |
| Backend      | Supabase (PostgreSQL, Auth, Realtime, Storage, Edge Functions) |
| Architecture | Feature-Sliced Design                                          |

### Project Structure (FSD)

```
src/
  app/        # bootstrap, router, global styles, i18n
  routes/     # TanStack Router file-based routes
  features/   # user-facing features (auth, tasks, git-integration, ci-cd, …)
  shared/     # api, ui kit, lib utilities
```

### Environment

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

---

## Core Features

### 1. Git-oriented Kanban & Sprints

- Every task **can** be tied to a Git branch (optional).
- "Generate branch" / "Link branch" / "No dedicated branch" in the task drawer.
- Shared/base branches (`main`, `dev`, …) may be linked but do not load full commit/PR lists.
- Tasks can link a pull request by number/URL (works without a dedicated branch); diff opens in-app.
- Drag-and-drop between columns updates task status; optionally syncs with linked pull requests.
- **Sprints** (ADR 0008): Board-scoped timeboxes; Backlog screen; Commitment / Scope change / Close report — see **Sprints (MVP)** above.

### 2. Mini-GitHub (PR & Code Diff)

- In-task tab: commits, PR status (Open / Merged / Draft), and **code diff** — without leaving the app.
- Diff rendering via `react-diff-viewer` or similar.
- Branch generator: `git checkout -b feature/issue-42-login-form` from task ID + title.
- **Merge stays on GitHub.** PlotOps is view/link/sync only (diff, status, branch/PR link). No in-app Merge / Approve / create-PR write actions. After a merge on GitHub, `github-webhook` moves the linked Task to the Board’s **last column** when the PR merges into that Board’s **Base branch**.

### 3. CI/CD Dashboard

- Screen showing GitHub Actions workflow runs for the linked repo (status, branch, commit).
- Detail dialog: jobs checklist + API-backed logs (chunked progressive display) + link out to GitHub.
- Linear-style summary (default branch + failed / in-progress counts) and client filters.

**Mock vs real (locked product intent):**

| Slice                    | What it does                                                                                          | Status                                             |
| ------------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------- |
| Mock CI UI               | Dashboard + simulated logs; same module seam (tests)                                                  | ✅ Done                                            |
| Stage 5 `github-webhook` | `pull_request` merge into Board Base branch → Task last column; `push` accepted no-op                 | Separate — **does not** populate CI builds or logs |
| Real GitHub Actions      | Live workflow runs via Actions REST behind `features/ci-cd` `buildsProvider`; polling while in-flight | ✅ Done                                            |

Agents: never assume webhook work replaces Actions integration.

### 4. Command Palette

> Grilled MVP (2026-07-24). Shipped via #22–#26.

**Surface:** Global on authenticated MainLayout. Open via `Ctrl+K` / `Cmd+K` and a TopBar button (same palette). Open/close UI state in Zustand. Shell: `@reui/c-command-7` over `cmdk`. Theme toggle uses existing `useTheme` (do not migrate theme to Zustand in this feature).

**MVP commands:**

| Command        | Behaviour                                                                                                                                                                                                                                                                   |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Search Tasks   | Current Project, all Boards; match `key` + `title`; exclude archived; results only after ≥1 character; max 20 (exact key first, then title). Select → navigate to that Task's Board and open Task drawer (`selectedTaskId`). Without Project in URL — Tasks section hidden. |
| Create Task    | Only when `boardId` is in the URL and `canCreateTasks`; otherwise hidden. Type title in cmdk → create on current Board first column with default type `task` → open drawer.                                                                                                 |
| Switch Project | List accessible Projects → navigate to `/projects/$projectId` (redirects to first Board).                                                                                                                                                                                   |
| Toggle theme   | Same as avatar menu theme toggle.                                                                                                                                                                                                                                           |

**Out of MVP / ideas to revisit:** see Deferred → Ideas to revisit (Command Palette). No separate Guest handling until Guest mode ships.

---

## Architecture Principles

- **Modular FSD:** `features/tasks`, `features/git-integration`, `features/ci-cd`, etc.
- **State split:** Zustand for UI (palette, theme); TanStack Query for server data.
- **Visual style:** dark, brutal, monospace for git metadata, neon accents on CI statuses. Linear / Neobrutalism vibe.

## Typography

Tokens live in `src/app/styles/index.css` (`text-h1` … `text-meta`). Pick by **role**, not by wanting a larger size.

| Role       | Token       | When                                                                |
| ---------- | ----------- | ------------------------------------------------------------------- |
| Page title | `text-h1`   | One per screen (`h1`). Scales 28px → 33px at `md`                   |
| Section    | `text-h2`   | Blocks inside a page (`h2`)                                         |
| Title      | `text-h3`   | Card / dialog / panel headers (`h3`; bare `h4` maps here)           |
| Body       | `text-body` | Paragraphs, long descriptions                                       |
| UI         | `text-ui`   | Nav, forms, list rows, dense chrome                                 |
| Code       | `text-code` | Branches, paths, diffs, commits                                     |
| Meta       | `text-meta` | Uppercase micro-labels: statuses, task keys, chips, avatar initials |

**Fonts:** Space Grotesk (headings), IBM Plex Sans (body/ui), JetBrains Mono (code/meta).

**Anti-patterns:** `text-3xl` / `text-2xl` / `text-lg` / `font-display` for titles; `text-meta` for sentences; fluid type on ui/body/code/meta.

---

## Supabase Backend

### Auth

- GitHub OAuth via Supabase Auth — avatar, username, email, session on the client.
- **Email/password signup** at `/sign-up` with **email confirmation** required before sign-in. Manager/Viewer (and other invitees) register with the invited email so `/invite/$token` can accept without the claim/confirm path. After signup, confirmation link redirects back to the pending invite when present.
- **Guest Mode** (critical for portfolio UX): prominent "Try demo without registration" button next to GitHub login. Starts a client-side Guest Session with a local sandbox (projects, kanban cards, CI logs, diffs) — no shared Supabase demo account (ADR 0018). Many employers close the tab rather than OAuth a pet project.

### Realtime Kanban

- Subscribe to `tasks` table changes via Supabase Realtime.
- Card moves in one browser instantly animate in another.

### Storage

- Drag-and-drop screenshots into tasks → Supabase Storage → URL in task description.

### Row Level Security (RLS)

- SQL policies: users can only read/write tasks in projects they belong to. Required for Middle-level portfolio proof.

### SQL Triggers

- Prefer app-level writes for curated activity (see **Task activity feed**). Triggers remain optional for other automations (e.g. webhook-driven status sync).

### Edge Functions

- `github-webhook` (GitHub App → HMAC): on `pull_request` closed+merged into the Task’s Board **Base branch**, match Task (`pr_number` → `branch_name` → `task_key` in head), set `status` to that Board’s last column (max `position`), set `pr_state=merged`, write `activity_log` with `user_id=null`. Idempotent. Skip (no project / no task / wrong base) → 200 + structured log. `push` → 200 no-op. Does **not** feed CI/CD. Setup: [`docs/github-webhook-setup.md`](github-webhook-setup.md).

---

## Database Schema

| Table           | Key columns                                                                                                                                                                                                                                  |
| --------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`      | `id` (uuid → auth.users), `username`, `avatar_url`                                                                                                                                                                                           |
| `projects`      | `id`, `name`, `slug`, `owner_id` → profiles                                                                                                                                                                                                  |
| `boards`        | `id`, `project_id`, `name`, `position`, `base_branch`, `allowed_head_patterns`                                                                                                                                                               |
| `board_columns` | `(board_id, id)` PK, `project_id`, `name`, `position`                                                                                                                                                                                        |
| `tasks`         | `id`, `project_id`, `board_id`, `sprint_id` (nullable → sprints), `title`, `description`, `status`, `priority`, `deadline`, `branch_name`, `assignee_id`, `author_id`, `archived_at`, `archived_by`                                          |
| `sprints`       | `id`, `board_id`, `project_id`, `name`, `goal`, `state` (`draft`/`active`/`closed`/`canceled`), `starts_on`, `ends_on`, `committed_task_ids` (uuid[]), `completed_task_ids` (uuid[]), `started_at`, `closed_at`, `canceled_at`, `created_at` |
| `sprint_events` | `id`, `sprint_id`, `project_id`, `actor_id`, `event_type` (`task_added`/`task_removed`/`started`/`closed`/`canceled`), `task_id` (nullable), `payload` (jsonb), `created_at`                                                                 |
| `task_comments` | `id`, `task_id`, `project_id`, `author_id`, `body`, `created_at`, `updated_at`                                                                                                                                                               |
| `labels`        | `id`, `project_id`, `name`, `color` (project-scoped; tasks reference via join / `label_ids`)                                                                                                                                                 |
| `activity_log`  | `id`, `task_id`, `project_id`, `user_id` → profiles, `action` (text), `metadata` (jsonb), `created_at`                                                                                                                                       |

Enable RLS and base policies before writing frontend code.

---

## Task activity feed

> Locked in grilling (2026-07-21). Context feed for the task drawer — **not** a Jira-style audit with description diffs. Keep payloads small for Supabase Free (500 MB DB).

### Product intent

- Show **who changed what** on a task so teammates have context.
- Not for rollback/restore, not for compliance-grade audit.

### What to log

| Include                                 | Exclude                                                              |
| --------------------------------------- | -------------------------------------------------------------------- |
| status, assignee, priority, deadline    | description (no body, no “description updated”)                      |
| title, type, labels                     | comments (stay in `task_comments` only)                              |
| branch / PR link or unlink              | position-only DnD reorders within a column (optional; skip if noisy) |
| move to another board                   |                                                                      |
| archive / restore (`field: "archived"`) |                                                                      |

### Event shape

- One **batch event per save** (one mutation / one logical update), not one row per field.
- Columns: `action` + `metadata` (jsonb), e.g. `action: "task_updated"`, `metadata: { changes: [{ field, from, to }, ...] }`.
- Client i18n renders copy from `action` + `metadata` (do not store localized `text` as source of truth).

### Write path

- **Application-level** inserts from `use-board` mutations (and equivalent APIs): drawer details, status select, kanban DnD status change, label replace, board move — all paths that change logged fields.
- Do **not** rely on a Postgres `UPDATE tasks` trigger for MVP (harder to filter curated fields).

### Read / UI

- Collapsible **Activity** section in the task drawer (collapsed by default).
- TanStack Query: load on expand; invalidate after own mutations. **No** Realtime subscription on `activity_log` for MVP.
- Soft UI cap: show the latest **50–100** events; keep all rows in DB (no retention job yet).

### Free-tier notes

- Enum/title/label metadata ≈ hundreds of bytes per event → negligible vs 500 MB.
- Storing old/new rich-text description (up to ~128 KiB) would dominate storage — explicitly out of scope.

---

## Development Roadmap

### Stage 1: Database Design (Days 1–3)

Create tables in Supabase admin. Write RLS policies. No frontend until schema is ready.

### Stage 2: Scaffold & Guest Mode (Days 4–7)

- Vite + React repo with FSD layout (`src/app`, `src/routes`, `src/features`, `src/shared`).
- Supabase Auth + GitHub provider.
- Demo user in DB; login page with guest button (email/password sign-in for demo account). Implementation plan when pulled: [`docs/deferred/wave-0-guest-mode.md`](deferred/wave-0-guest-mode.md).
- `seed.sql`: 2 projects, ~15 tasks with descriptions, tags, activity history.

### Stage 3: Kanban Core (Week 2)

- Columns by status; DnD via `@dnd-kit` or `@hello-pangea/dnd`.
- TanStack Query for `tasks` with **optimistic updates** on drag.
- Supabase Realtime — verify two-browser sync.

### Stage 4: Git Integration (Week 3)

- Read `provider_token` from Supabase session.
- Task Git tab: commits + PRs by `branch_name` (skipped for shared/base branches).
- Code diff viewer for PRs (`@git-diff-view`: split/unified, syntax highlight, file list).
- Branch name generator, link existing branch, or skip dedicated branch.
- Link PR by number/URL → persist `pr_*` on task; view diff without a feature branch.
- No Merge button in-app — merge happens on GitHub (see Core Features §2 / Deferred).

### Stage 5: Webhooks (Week 4)

- Register a free GitHub App; webhook events `pull_request`, `push` → Edge Function `github-webhook`.
- On PR merged into the Task’s Board **Base branch**, move Task to the Board’s **last column** (not a hardcoded `DONE` / `main`). Match: `pr_number` → `branch_name` → `task_key` in head. `push` accepted no-op.
- Ops: `verify_jwt = false` + HMAC secret; skip paths return 200 (avoid GitHub retry storms); admin runbook in `docs/github-webhook-setup.md`.
- **Out of scope for this stage:** CI build status and logs; in-app App install UI. Webhooks here are Task sync only.

### Stage 5b: Real CI/CD — GitHub Actions ✅

- `features/ci-cd` default provider is GitHub Actions REST (`list runs` / `jobs` / job logs zip) behind `buildsProvider`; mock retained for unit tests.
- Live run status per branch; API-backed logs in the detail dialog; TanStack Query polling while runs are queued/running.
- Progress **CI/CD — real GitHub Actions** marked Done when the dashboard reflects the linked repo’s actual runs.

### Stage 6: Polish & Deploy (Final)

- Command palette (`cmdk`).
- UI polish — strict dark theme, status accents.
- Deploy frontend (Vercel / Cloudflare Pages — static Vite build).
- **UptimeRobot** ping on Supabase/API URL so free-tier DB does not sleep after 7 days of inactivity.

---

## Hosting Cost (Demo)

| Service                                          | Cost |
| ------------------------------------------------ | ---- |
| Frontend (Vercel Hobby / Cloudflare Pages)       | $0   |
| Supabase Free (500 MB DB, 1 GB storage, 50k MAU) | $0   |
| GitHub API                                       | $0   |

**Pitfall:** Supabase free tier pauses DB after 7 days idle. Fix: UptimeRobot pings every few minutes.

---

## Portfolio Signals (Middle Level)

- RLS policies in Supabase
- TanStack Query custom hooks (not raw `useEffect` + Supabase client)
- Optimistic updates on kanban
- SQL triggers / functions
- Realtime multi-user sync
- GitHub webhooks + Edge Functions
- Guest mode with product-minded UX

---

## For Backend Collaborators

Clean PostgreSQL schema with foreign keys. Others can:

1. Build microservices (e.g. Go/Node webhook handlers) against the same DB.
2. Use Supabase Edge Functions for heavy server logic.
