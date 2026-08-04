# Wave 0 — Guest Mode (implementation plan)

**Size:** L–XL · **Own plan:** this document · **Status:** not started (SPEC Progress ⬜)  
**Pulls when:** portfolio demo needs OAuth-free first minute.  
**Unlocks:** Deferred “Guest-specific palette behaviour” (Wave 4 checklist item; can ship in same epic).

## Goal

Prominent “Try demo without registration” on sign-in. Auto-login as a pre-seeded demo user with rich fake data (Teams/Projects, kanban cards, activity, fake diffs and CI logs). Employers should explore PlotOps without GitHub OAuth.

## Locked product intent (from SPEC)

- Auth: email/password sign-in for a fixed demo account (not a second OAuth path).
- Data: `supabase/seed.sql` today is empty — seed must become the guest dataset (local + documented remote seed path).
- Git/CI: guest has no real `provider_token`; force mock / canned seams (`features/ci-cd` mock provider, git-integration fixtures) for the demo team only.
- Palette: after Guest ships, narrow command set for demo (no misleading Create/Search against empty world; see Wave 4 note in [wave-4-plus-later.md](./wave-4-plus-later.md)).

## Assumptions (lock in grilling if needed)

1. One shared demo identity (e.g. `demo@plotops.app`); concurrent guests share the same rows — acceptable for portfolio; mutations may pollute demo (reset via `db reset` locally / documented reseed).
2. Guest is a normal auth user under RLS, not a bypass of RLS.
3. Demo Team/Projects are seeded members of that user; no special “guest role” in `team_members`.

## Implementation slices

### 1. Identity & credentials (S)

- Create auth user + `profiles` row in seed (or documented Supabase dashboard + seed for app tables).
- Env docs: demo email/password for local (never commit production secrets; use well-known local-only password in seed comments / `docs/SUPABASE.md`).
- Flag detection: compare `auth.uid()` / email to known demo identity in a small `shared` or `features/auth` helper (`isGuestSession`).

### 2. Seed dataset (M–L)

Touch [`supabase/seed.sql`](../../supabase/seed.sql) (currently optional/empty):

- 1 Team, 2 Projects (one with fake `github_*` fields for Git/CI UI; optional second without repo if Wave 1 no-GH not yet shipped).
- Boards, columns, ~15 Tasks (labels, priority, assignee, branch/PR fields, descriptions).
- Sprint draft/active samples; a handful of `activity_log`, comments, watchers/notifications if cheap.
- Verify with `npm run db:reset` locally. Remote: document one-time seed procedure (CI must not wipe prod) in [`docs/SUPABASE.md`](../SUPABASE.md).

### 3. Sign-in UX (S)

- [`src/features/auth/ui/login-form.tsx`](../../src/features/auth/ui/login-form.tsx): primary secondary CTA next to GitHub — “Try demo”.
- Call existing `signInWithPassword` with demo credentials (from `import.meta.env` e.g. `VITE_GUEST_EMAIL` / `VITE_GUEST_PASSWORD`, or hardcode only for known local demo).
- i18n en/ru; focus-visible + mobile layout.
- After success: same `/home` redirect path as password login (skip pending-invite).

### 4. Git & CI seams for guest (M)

- When `isGuestSession`: route `features/ci-cd` through mock `buildsProvider` (already exists for tests).
- Git tab: return fixture commits/PRs/diffs when token missing or guest; do not call GitHub REST.
- Webhook: N/A for demo; static `pr_state` on seeded tasks.

### 5. Guardrails (S)

- Hide or no-op dangerous guest actions if needed: delete Team/Project, invite creation (or allow and accept pollution).
- TopBar / settings: show “Demo account” chip so viewers know data is shared.
- Optional: block complete-profile gate for seeded profile (ADR 0015).

### 6. Guest palette (S) — may follow immediately

- In [`src/features/command-palette/model/rules.ts`](../../src/features/command-palette/model/rules.ts): visibility helper respects guest (keep Search Tasks / Switch Project / Toggle theme; decide Create Task on/off).
- Tests in existing `rules.test.ts`.

### 7. Progress & SPEC

- Mark Progress **Guest mode** Done; move Guest-specific palette out of Deferred when done.
- Portfolio signal checklist in SPEC already lists Guest Mode.

## Key files

| Area    | Paths                                                    |
| ------- | -------------------------------------------------------- |
| Auth UI | `src/features/auth/ui/login-form.tsx`, `auth-api.ts`     |
| Seed    | `supabase/seed.sql`, `docs/SUPABASE.md`                  |
| CI mock | `src/features/ci-cd/api/mock-builds.ts`, provider seam   |
| Git     | `src/features/git-integration/**` (token / guest branch) |
| Palette | `src/features/command-palette/model/rules.ts`            |

## Acceptance

- [ ] Cold visitor reaches Board with cards in ≤2 clicks from `/sign-in` without OAuth.
- [ ] Guest Board/Backlog/CI/Git tabs render meaningful demo content without GitHub API errors.
- [ ] Real user accounts unchanged; RLS still enforces membership.
- [ ] `db:reset` locally yields reproducible demo.
- [ ] SPEC Progress updated.

## Out of scope

- Per-browser isolated guest sandboxes.
- Real GitHub App install for demo.
- Wave 1+ Deferred items except guest palette narrowing.
