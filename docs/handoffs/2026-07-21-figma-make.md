# Handoff: PlotOps → Figma Make design-from-scratch

**Date:** 2026-07-21  
**Branch:** `dev`  
**Next session focus:** Continue Figma Make design work for PlotOps (or resume related UI work) from another machine.

## How to pick this up at home

1. `git checkout dev && git pull`
2. Open a **new** Cursor chat
3. Attach or `@` this file: `docs/handoffs/2026-07-21-figma-make.md`
4. Say what you want next (A/B/C below)

Cursor chats do **not** sync across machines — only git (and this file) travels.

## Goal of the previous session

User asked which **project files to attach to Figma Make** when designing PlotOps **from scratch**. Answer was given; no code was changed in that chat. User needed a handoff because Cursor chat history stays on the device where it was written.

## Key decisions / guidance already given

Figma Make works best with a **small curated attachment set**, not the whole repo. Prefer text/md/code; build **screen by screen** (1–2 screens per prompt).

### Must attach

| File | Why |
|------|-----|
| `docs/SPEC.md` | Product, screens, visual direction |
| `src/app/styles/index.css` | Colors, radius, fonts, type roles |
| `components.json` | shadcn/ui kit config |

### Structure screens (attach in batches)

**Shell**

- `src/widgets/main-layout/ui/main-layout.tsx`
- `src/widgets/header/ui/header.tsx`
- `src/widgets/dock/ui/app-dock.tsx`

**Kanban**

- `src/widgets/kanban-board/ui/board-page.tsx`
- `src/widgets/kanban-board/ui/kanban-board.tsx`
- `src/widgets/kanban-board/ui/kanban-column.tsx`
- `src/widgets/kanban-board/ui/draggable-task-card.tsx`

**Task drawer**

- `src/features/tasks/ui/task-drawer.tsx`
- Optional: `task-comments-section.tsx`, `task-activity-section.tsx`, `task-github-panel.tsx`

**Projects home**

- `src/features/projects/ui/projects-page.tsx`

### Labels / copy

- `src/app/locales/board/en.json`
- `src/app/locales/common/en.json`
- `src/app/locales/home/en.json` (if designing home)

### Do not attach

- API/hooks/migrations (`*-api.ts`, `use-*.ts`, `supabase/`)
- Entire `src/shared/shadcn/ui/` dump
- `.env` / secrets / large binaries

### Prompt pattern recommended

1. Attach SPEC + CSS + `components.json`
2. Prompt: dark Linear/neobrutalism CRM; sharp borders; monospace for git; neon CI accents; desktop-first
3. Then separate turns: board → task drawer → projects → CI dashboard
4. Explicitly say **style reference from code** (not 1:1 pixel copy) unless they want a literal port

### Two modes

- **New design:** SPEC + CSS + 2–3 live screenshots may be enough; TSX secondary
- **Match existing PlotOps:** add shell + board + drawer TSX

Official Make notes (for agent): attachments under ~10MB; prefer md/code/json; kits/guidelines if available later.

## Product / design source of truth (do not re-summarize)

- Spec + progress: `docs/SPEC.md`
- Domain glossary: `docs/CONTEXT.md`
- ADRs: `docs/adr/0001`–`0006` (esp. boards under project = `0006`)
- Supabase notes: `docs/SUPABASE.md`
- Visual rules also in workspace rule `.cursor/rules/plotops.mdc` (dark, Linear/neobrutalism, shadcn preference, FSD)

### Typography / fonts (from SPEC)

- Tokens in `src/app/styles/index.css`: `text-h1` … `text-meta`
- Fonts: Space Grotesk (headings), IBM Plex Sans (body/ui), JetBrains Mono (code/meta)

## Related recent work (already on `dev`)

Recent commits on this branch already landed board comments, activity feed, archive, member field, labels settings polish, and SPEC updates. Next agent should `git status` / `git log` before assuming more WIP.

Do **not** commit unless the user asks. PlotOps Supabase ref must come from `.env` (project ref `ijcelrdcygzyzhcijkhe`); never target other projects.

## What is NOT done yet (Figma Make thread)

- No Figma Make file created
- No design pushed via Figma MCP
- No code changes from the Figma-files chat itself

## Suggested next steps

1. Open this handoff in a new Cursor chat + PlotOps on `dev`
2. Confirm whether next goal is:
   - **A)** Generate PlotOps UI in Figma Make from the attachment list above, or
   - **B)** Resume product/feature work on the board, or
   - **C)** Something else
3. If A: start Make with SPEC + `index.css` + `components.json`, then board shell only
4. If using Figma MCP in Cursor later: load `figma-generate-design` or `figma-use` skills before write tools; design-to-code uses `get_design_context`

## Suggested skills

- Figma: `figma-generate-design`, `figma-use`, `figma-create-new-file` (when creating/editing in Figma)
- If resuming board WIP: follow `docs/SPEC.md` Progress + existing FSD patterns
- If turning Make output into tickets: `/to-tickets` or `/to-spec` (mattpocock)
- If grilling the design brief first: `/grill-me`

## Redaction

No secrets included. Do not attach `.env` or publishable keys to Figma Make.
