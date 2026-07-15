# PlotOps — Product & Technical Specification

> Git-oriented CRM (Jira/Linear clone) with GitHub integration.
> Source of truth: this file + [Notion page](https://app.notion.com/p/39773411f401806b85b3d072b7bff6d9).

## Progress

> **Maintainers:** update this section when a roadmap item or stage is done. Agents: update after completing a feature in the same change set.

| Area | Status |
|------|--------|
| Project scaffold (Vite, FSD, ESLint) | ✅ Done |
| Routing (TanStack Router) | ✅ Done |
| i18n (i18next) | ✅ Done |
| Auth (Supabase, GitHub OAuth UI) | ✅ Done |
| Guest mode | ⬜ Not started |
| Database schema + RLS (`projects`) | ✅ Done |
| GitHub project import (home page) | ✅ Done |
| Kanban board | ✅ Done (custom columns, labels/priority/deadline on tasks; DnD polish deferred) |
| Git integration (PR, diff, branches) | ⬜ Not started |
| CI/CD dashboard | ⬜ Not started |
| Command palette | ⬜ Not started |
| GitHub webhooks + Edge Function | ⬜ Not started |

## Tech Stack

| Layer | Choice |
|-------|--------|
| Build | Vite 8 |
| UI | React 19, Tailwind CSS 4, shadcn/ui |
| Routing | TanStack Router |
| Server state | TanStack Query |
| UI state | Zustand (when local `useState` is not enough) |
| i18n | i18next + react-i18next |
| Backend | Supabase (PostgreSQL, Auth, Realtime, Storage, Edge Functions) |
| Architecture | Feature-Sliced Design |

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

- Every task is tied to a Git branch.
- "Create branch" button in a task card generates a proper name (e.g. `feature/TASK-123-login-page`) and copies the terminal command.
- Drag-and-drop between columns updates task status; optionally syncs with linked pull requests.

### 2. Mini-GitHub (PR & Code Diff)

- In-task tab: commits, PR status (Open / Merged / Draft), and **code diff** — without leaving the app.
- Diff rendering via `react-diff-viewer` or similar.
- Branch generator: `git checkout -b feature/issue-42-login-fix` from task ID + title.

### 3. CI/CD Dashboard

- Screen showing build status per branch (`main` — passed, `feature/analytics` — failed on tests).
- Streaming build logs (mock with `setInterval` initially; real GitHub Actions later).

### 4. Command Palette

- `Ctrl+K` / `Cmd+K` — search tasks, create bugs, switch projects, toggle theme.
- Library: `cmdk`.

---

## Architecture Principles

- **Modular FSD:** `features/tasks`, `features/git-integration`, `features/ci-cd`, etc.
- **State split:** Zustand for UI (palette, theme); TanStack Query for server data.
- **Visual style:** dark, brutal, monospace for git metadata, neon accents on CI statuses. Linear / Neobrutalism vibe.

## Typography

Tokens live in `src/app/styles/index.css` (`text-h1` … `text-meta`). Pick by **role**, not by wanting a larger size.

| Role | Token | When |
|------|-------|------|
| Page title | `text-h1` | One per screen (`h1`). Scales 28px → 33px at `md` |
| Section | `text-h2` | Blocks inside a page (`h2`) |
| Title | `text-h3` | Card / dialog / panel headers (`h3`; bare `h4` maps here) |
| Body | `text-body` | Paragraphs, long descriptions |
| UI | `text-ui` | Nav, forms, list rows, dense chrome |
| Code | `text-code` | Branches, paths, diffs, commits |
| Meta | `text-meta` | Uppercase micro-labels: statuses, task keys, chips, avatar initials |

**Fonts:** Space Grotesk (headings), IBM Plex Sans (body/ui), JetBrains Mono (code/meta).

**Anti-patterns:** `text-3xl` / `text-2xl` / `text-lg` / `font-display` for titles; `text-meta` for sentences; fluid type on ui/body/code/meta.

---

## Supabase Backend

### Auth

- GitHub OAuth via Supabase Auth — avatar, username, email, session on the client.
- **Guest Mode** (critical for portfolio UX): prominent "Try demo without registration" button next to GitHub login. Auto-login as a pre-seeded demo user with rich fake data (projects, kanban cards, CI logs, diffs). Many employers close the tab rather than OAuth a pet project.

### Realtime Kanban

- Subscribe to `tasks` table changes via Supabase Realtime.
- Card moves in one browser instantly animate in another.

### Storage

- Drag-and-drop screenshots into tasks → Supabase Storage → URL in task description.

### Row Level Security (RLS)

- SQL policies: users can only read/write tasks in projects they belong to. Required for Middle-level portfolio proof.

### SQL Triggers

- Example: when task status → `DONE`, auto-insert into `activity_log`: "User X closed task Y".

### Edge Functions

- `github-webhook`: on PR merged to `main`, parse branch name, find task, set status `DONE`.

---

## Database Schema

| Table | Key columns |
|-------|-------------|
| `profiles` | `id` (uuid → auth.users), `username`, `avatar_url` |
| `projects` | `id`, `name`, `slug`, `owner_id` → profiles |
| `tasks` | `id`, `project_id`, `title`, `description`, `status`, `priority`, `deadline`, `branch_name`, `assignee_id` |
| `labels` | `id`, `project_id`, `name`, `color` (project-scoped; tasks reference via join / `label_ids`) |
| `activity_log` | `id`, `task_id`, `user_id`, `text`, `created_at` |

Enable RLS and base policies before writing frontend code.

---

## Development Roadmap

### Stage 1: Database Design (Days 1–3)

Create tables in Supabase admin. Write RLS policies. No frontend until schema is ready.

### Stage 2: Scaffold & Guest Mode (Days 4–7)

- Vite + React repo with FSD layout (`src/app`, `src/routes`, `src/features`, `src/shared`).
- Supabase Auth + GitHub provider.
- Demo user in DB; login page with guest button (email/password sign-in for demo account).
- `seed.sql`: 2 projects, ~15 tasks with descriptions, tags, activity history.

### Stage 3: Kanban Core (Week 2)

- Columns by status; DnD via `@dnd-kit` or `@hello-pangea/dnd`.
- TanStack Query for `tasks` with **optimistic updates** on drag.
- Supabase Realtime — verify two-browser sync.

### Stage 4: Git Integration (Week 3)

- Read `provider_token` from Supabase session.
- Task Git tab: commits + PRs by `branch_name`.
- Code diff viewer for PRs.
- Branch name generator button.

### Stage 5: Webhooks (Week 4)

- Register GitHub App; webhooks for `pull_request`, `push`.
- Edge Function `github-webhook` syncs merge → task `DONE`.

### Stage 6: Polish & Deploy (Final)

- Command palette (`cmdk`).
- UI polish — strict dark theme, status accents.
- Deploy frontend (Vercel / Cloudflare Pages — static Vite build).
- **UptimeRobot** ping on Supabase/API URL so free-tier DB does not sleep after 7 days of inactivity.

---

## Hosting Cost (Demo)

| Service | Cost |
|---------|------|
| Frontend (Vercel Hobby / Cloudflare Pages) | $0 |
| Supabase Free (500 MB DB, 1 GB storage, 50k MAU) | $0 |
| GitHub API | $0 |

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
