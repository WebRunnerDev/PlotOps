# PlotOps

Git-oriented CRM (Jira/Linear clone) with GitHub integration.

Collaboration and access are scoped to a **Project** — there is no separate Team entity in the MVP. Full product/tech spec: [`docs/SPEC.md`](docs/SPEC.md). Domain glossary: [`CONTEXT.md`](CONTEXT.md).

## Features

| Area                                                                                | Status      |
| ----------------------------------------------------------------------------------- | ----------- |
| Auth (GitHub OAuth + email signup/confirm)                                          | Done        |
| GitHub project import                                                               | Done        |
| Kanban board (columns, labels, priority, deadline, filters, comments, soft-archive) | Done        |
| Multi-board + branch mapping (base branch, allowed head patterns)                   | Done        |
| Task rich text + media (TipTap, Storage)                                            | Done        |
| Task activity feed                                                                  | Done        |
| Team & permissions (`project_members`, roles, invites)                              | Done        |
| Git integration (PR, diff, branches)                                                | In progress |
| Guest mode                                                                          | Not started |
| CI/CD dashboard                                                                     | Done        |
| Command palette (`Ctrl/Cmd+K`)                                                      | Not started |
| GitHub webhooks + Edge Function                                                     | Done        |

**Roadmap highlights**

- **Git Kanban** — tasks optionally linked to branches; drag-and-drop updates status; branch name generator (`feature/TASK-123-login-page`)
- **In-app Git** — PR list, commit history, code diff viewer (no redirect to GitHub)
- **CI/CD Dashboard** — build status per branch, streaming build logs
- **Command Palette** — search tasks, create bugs, switch projects
- **Guest Mode** — demo without GitHub OAuth; pre-seeded projects, tasks, fake diffs and CI logs

## Domain (MVP)

| Term              | Meaning                                                                                |
| ----------------- | -------------------------------------------------------------------------------------- |
| **Project**       | Unit of ownership and collaboration (members, boards, tasks, linked GitHub repo)       |
| **Board**         | Kanban workflow inside a Project; owns columns, base branch, and allowed head patterns |
| **Task**          | Unit of work on exactly one Board; may link a Git branch and/or PR                     |
| **Member / Role** | Project membership with Admin, Manager, Contributor, or Viewer                         |
| **Owner**         | `projects.owner_id` — full control; not a `project_members` row                        |
| **Invite**        | Email-addressed join offer; copy-link delivery (no SMTP in MVP)                        |

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
  features/   # auth, tasks, git-integration, …
  shared/     # api, ui kit, lib utilities
```

## Getting Started

### Prerequisites

- Node.js 20+
- A [Supabase](https://supabase.com) project
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
| `npm run db:status`            | List remote vs local migrations (read-only)  |
| `npm run db:start` / `db:stop` | Local Supabase (Docker)                      |
| `npm run db:reset`             | Reset local DB from migrations               |
| `npm run db:local-status`      | Local URL + keys                             |
| `npm run db:new -- <name>`     | Create a new migration                       |
| `npm run db:push`              | Emergency remote apply only (not day-to-day) |
| `npm run shadcn:add -- <name>` | Add a shadcn/ui component                    |

Pre-commit (Husky + lint-staged): ESLint `--fix` and Prettier on staged files. Hooks install via `npm install` (`prepare`).

## Design

Dark, strict, Linear / Neobrutalism-inspired: sharp borders, monospace for git elements, neon accents on build statuses. Typography tokens (`text-h1` … `text-meta`) live in `src/app/styles/index.css` — Space Grotesk, IBM Plex Sans, JetBrains Mono.

## Docs

| Doc                                    | Contents                                                |
| -------------------------------------- | ------------------------------------------------------- |
| [`docs/SPEC.md`](docs/SPEC.md)         | Product & technical specification, progress, roadmap    |
| [`CONTEXT.md`](CONTEXT.md)             | Ubiquitous language (Project, Board, roles, invites, …) |
| [`docs/SUPABASE.md`](docs/SUPABASE.md) | Supabase project / CLI notes                            |
| [`docs/adr/`](docs/adr/)               | Architecture decision records                           |

## License

Private portfolio project.
