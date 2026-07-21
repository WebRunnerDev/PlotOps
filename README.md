# PlotOps

Git-oriented CRM (Jira/Linear clone) with GitHub integration. Portfolio project targeting middle-level frontend skills.

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
| Team & permissions (`project_members`, roles, invites)                              | In progress |
| Git integration (PR, diff, branches)                                                | In progress |
| Guest mode                                                                          | Not started |
| CI/CD dashboard                                                                     | Not started |
| Command palette (`Ctrl/Cmd+K`)                                                      | Not started |
| GitHub webhooks + Edge Function                                                     | Not started |

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

Fill in `.env`:

```env
VITE_SUPABASE_URL=https://<project-ref>.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

Link and push schema (one-time link, then when migrations change):

```bash
npm run db:link
npm run db:push
```

### Develop

```bash
npm run dev
```

### Other scripts

| Script                         | Purpose                        |
| ------------------------------ | ------------------------------ |
| `npm run build`                | Typecheck + production build   |
| `npm run typecheck`            | TypeScript project build check |
| `npm run lint`                 | ESLint                         |
| `npm run format`               | Format with Prettier           |
| `npm run db:status`            | List linked migrations         |
| `npm run db:new -- <name>`     | Create a new migration         |
| `npm run shadcn:add -- <name>` | Add a shadcn/ui component      |

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
