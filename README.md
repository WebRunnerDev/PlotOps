# PlotOps

Git-native project tracker (Linear/Jira-style) with GitHub integration.

Collaboration and access are scoped to a **Project** — there is no separate Team entity in the MVP. Full product/tech spec: [`docs/SPEC.md`](docs/SPEC.md). Domain glossary: [`CONTEXT.md`](CONTEXT.md).

## Features

| Area                                                                                | Status      |
| ----------------------------------------------------------------------------------- | ----------- |
| Auth (GitHub OAuth + email signup/confirm + complete profile)                       | Done        |
| GitHub project import                                                               | Done        |
| Kanban board (columns, labels, priority, deadline, filters, comments, soft-archive) | Done        |
| Multi-board + branch mapping (base branch, allowed head patterns)                   | Done        |
| Sprints (Board-scoped backlog, start/close/cancel, report)                          | Done        |
| Task rich text + media (TipTap, Storage)                                            | Done        |
| Task activity feed                                                                  | Done        |
| Team & permissions (`project_members`, roles, invites)                              | Done        |
| Notifications (Watch + assignment + structural kinds)                               | Done        |
| Mentions (`@` in description/comments → always-on inbox)                            | Done        |
| App chrome (top bar, project tabs, breadcrumbs)                                     | Done        |
| Command palette (`Ctrl/Cmd+K`)                                                      | Done        |
| CI/CD dashboard (GitHub Actions)                                                    | Done        |
| GitHub webhooks + Edge Function                                                     | Done        |
| Git integration (PR, diff, branches)                                                | In progress |
| Guest mode                                                                          | Not started |

### Roadmap highlights

- **Git Kanban** — tasks optionally linked to branches; drag-and-drop updates status; branch name generator (`feature/TASK-123-login-page`)
- **In-app Git** — PR list, commit history, code diff viewer (no redirect to GitHub) — in progress
- **CI/CD Dashboard** — build status per branch, jobs + logs from GitHub Actions
- **Command Palette** — search tasks, create tasks, switch projects, toggle theme
- **Guest Mode** — demo without GitHub OAuth; pre-seeded projects, tasks, fake diffs and CI logs

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
