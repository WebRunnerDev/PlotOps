# PlotOps

<img src="/public/PlotOps.png" width=350 height=350>

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![React](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)](https://react.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite](https://img.shields.io/badge/Vite-8-646CFF?logo=vite&logoColor=white)](https://vite.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3FCF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?logo=tailwindcss&logoColor=white)](https://tailwindcss.com/)

**Git-native project tracker** — a Linear/Jira-style board where tasks, branches, pull requests, and CI runs live in one place. Built as an open portfolio project to showcase modern frontend architecture (React 19, TanStack, Feature-Sliced Design) with a real Supabase backend and GitHub integration.

Stay on the board instead of tab-hopping: link a task to a branch, review diffs in-app, watch GitHub Actions status, and let webhooks move cards when a PR merges.

Collaboration is scoped to a **Team**; Projects live under a Team ([ADR 0017](docs/adr/0017-team-above-project.md)). Full product/tech spec: [`docs/SPEC.md`](docs/SPEC.md). Domain glossary: [`CONTEXT.md`](CONTEXT.md).

## Features

| Area                                                                                | Status      |
| ----------------------------------------------------------------------------------- | ----------- |
| Auth (GitHub OAuth + email signup/confirm + complete profile)                       | Done        |
| Guest mode (local sandbox — “Try demo”, no shared remote login)                     | Done        |
| GitHub project import                                                               | Done        |
| Kanban board (columns, labels, priority, deadline, filters, comments, soft-archive) | Done        |
| Multi-board + branch mapping (base branch, allowed head patterns)                   | Done        |
| Sprints (board-scoped backlog, start/close/cancel, report, estimates)               | Done        |
| Task rich text + media (TipTap, Storage)                                            | Done        |
| Task activity feed                                                                  | Done        |
| Team & permissions (Team above Project — ADR 0017)                                  | Done        |
| Notifications (Watch + assignment + structural kinds)                               | Done        |
| Mentions (`@` in description/comments → always-on inbox)                            | Done        |
| App chrome (top bar, project tabs, breadcrumbs)                                     | Done        |
| Command palette (`Ctrl/Cmd+K`)                                                      | Done        |
| CI/CD dashboard (GitHub Actions — jobs, logs, polling)                              | Done        |
| GitHub webhooks + Edge Function (PR merge → task column sync)                       | Done        |
| Git integration (PR link, in-app diff, Open PR + Merge)                             | Done        |
| Deeper Git polish (commits history, UX refinements)                                 | In progress |

### Roadmap highlights

- **Git Kanban** — tasks linked to branches; drag-and-drop updates status; branch name generator (`feature/TASK-123-login-page`)
- **In-app Git** — PR list, commit history, code diff viewer without leaving the app
- **CI/CD Dashboard** — build status per branch, jobs + streaming logs from GitHub Actions
- **Command Palette** — search tasks, create tasks, switch projects, toggle theme
- **Guest Mode** — try the app without GitHub OAuth; client-side sandbox with pre-seeded data

## Domain (MVP)

| Term              | Meaning                                                                                 |
| ----------------- | --------------------------------------------------------------------------------------- |
| **Project**       | Unit of ownership and collaboration (members, boards, tasks, linked GitHub repo)        |
| **Board**         | Kanban workflow inside a Project; owns columns, base branch, and allowed head patterns  |
| **Task**          | Unit of work on exactly one Board; may link a Git branch and/or PR; optional Sprint     |
| **Sprint**        | Board-scoped timebox (`draft` → `active` → `closed` \| `canceled`); ≤1 Active per Board |
| **Backlog**       | Tasks on a Board with no Sprint assignment                                              |
| **Member / Role** | Project membership with Admin, Manager, Contributor, or Viewer                          |
| **Owner**         | `projects.owner_id` — full control; not a `project_members` row                         |
| **Invite**        | Email-addressed join offer; copy-link delivery (no SMTP in MVP)                         |
| **Watch**         | Personal subscription to curated structural Task events                                 |
| **Mention**       | Structured `@` reference in Description/Comment → always-on Notification                |

See [`CONTEXT.md`](CONTEXT.md) for full glossary and role capabilities.

## Tech Stack

| Layer        | Choice                                                         |
| ------------ | -------------------------------------------------------------- |
| Build        | Vite 8                                                         |
| UI           | React 19, Tailwind CSS 4, shadcn/ui                            |
| Routing      | TanStack Router                                                |
| Server state | TanStack Query                                                 |
| UI state     | Zustand (when needed)                                          |
| i18n         | i18next                                                        |
| Backend      | Supabase (PostgreSQL, Auth, Realtime, Storage, Edge Functions) |
| Architecture | Feature-Sliced Design                                          |

```
src/
  app/        # bootstrap, router, global styles, i18n
  routes/     # TanStack Router file-based routes
  features/   # auth, tasks, boards, sprints, git-integration, …
  shared/     # api, ui kit, lib utilities
```

## Getting Started

### Prerequisites

- Node.js 20+
- Docker Desktop (for local Supabase)
- A [Supabase](https://supabase.com) project (remote PlotOps, or local Docker only)
- (Optional) Supabase CLI for migrations: `npx supabase login`

### Setup

```bash
npm install
cp .env.example .env
```

Fill in `.env` (remote PlotOps):

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

**Local DB (Docker)** — default place to create and verify migrations (do not push schema from your laptop):

```bash
# Docker Desktop must be running
npm run db:start
# keys are printed; or copy from npm run db:local-status into .env.local
npm run db:new -- <name>  # add migration under supabase/migrations/
npm run db:reset          # re-apply all migrations from scratch
npm run dev               # uses .env.local over .env
```

Optional local GitHub OAuth: set `SUPABASE_AUTH_EXTERNAL_GITHUB_CLIENT_ID` / `SECRET` in `.env.local` (separate OAuth App; callback `http://127.0.0.1:54321/auth/v1/callback`). See `.env.example`.

Remote schema is applied by **CI/CD** after merge. Do not run `npm run db:push` in day-to-day work (emergency / explicit ask only). See [`docs/SUPABASE.md`](docs/SUPABASE.md).

### Develop

```bash
npm run dev
```

With `.env.local` present, the app talks to local Supabase (`127.0.0.1:54321`). Without it, `.env` (remote) is used. See `docs/SUPABASE.md`.

### Other scripts

| Script                         | Purpose                                      |
| ------------------------------ | -------------------------------------------- |
| `npm run build`                | Typecheck + production build                 |
| `npm run typecheck`            | TypeScript project build check               |
| `npm run lint`                 | ESLint                                       |
| `npm run format`               | Format with Prettier                         |
| `npm test`                     | Run Vitest once                              |
| `npm run test:watch`           | Vitest watch mode                            |
| `npm run db:status`            | List remote vs local migrations (read-only)  |
| `npm run db:start` / `db:stop` | Local Supabase (Docker)                      |
| `npm run db:reset`             | Reset local DB from migrations               |
| `npm run db:local-status`      | Local URL + keys                             |
| `npm run db:new -- <name>`     | Create a new migration                       |
| `npm run db:push`              | Emergency remote apply only (not day-to-day) |
| `npm run shadcn:add -- <name>` | Add a shadcn/ui component                    |
| `npm run shadcn:exports`       | Regenerate shadcn barrel exports             |

Pre-commit (Husky + lint-staged): ESLint `--fix` and Prettier on staged files. Hooks install via `npm install` (`prepare`).

## Design

Dark, strict, Linear / Neobrutalism-inspired: sharp borders, monospace for git elements, neon accents on build statuses. Typography tokens (`text-h1` … `text-meta`) live in `src/app/styles/index.css` — Space Grotesk, IBM Plex Sans, JetBrains Mono.

## Docs

| Doc                                                            | Contents                                                |
| -------------------------------------------------------------- | ------------------------------------------------------- |
| [`docs/SPEC.md`](docs/SPEC.md)                                 | Product & technical specification, progress, roadmap    |
| [`CONTEXT.md`](CONTEXT.md)                                     | Ubiquitous language (Project, Board, roles, invites, …) |
| [`docs/SUPABASE.md`](docs/SUPABASE.md)                         | Supabase project / CLI notes                            |
| [`docs/github-webhook-setup.md`](docs/github-webhook-setup.md) | GitHub App + webhook Edge Function setup                |
| [`docs/adr/`](docs/adr/)                                       | Architecture decision records                           |
| [`docs/agents/`](docs/agents/)                                 | Agent notes (issue tracker, triage, domain)             |

## Disclaimer

PlotOps is a portfolio / demo project, not a commercial service. Account data (first name, last name, email, GitHub profile fields) is stored with third-party providers (including Supabase) outside Kazakhstan. Use at your own risk. To request deletion of your account or personal data, open a GitHub issue on this repository or contact the repository owner.

## License

This project is licensed under the [MIT License](LICENSE).
