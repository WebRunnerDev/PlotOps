# Wave 0 — Guest Mode (implementation plan)

**Size:** L–XL · **Own plan:** this document · **Status:** superseded for product path by ADR 0018 / #161  
**Pulls when:** portfolio demo needs OAuth-free first minute.  
**Unlocks:** Deferred “Guest-specific palette behaviour” (Wave 4 checklist item; can ship in same epic).

## Goal

Prominent “Try demo without registration” on sign-in. Visitor starts a **client-side Guest Session** with rich fake data (Teams/Projects, kanban cards, activity, fake diffs and CI logs) and **zero Supabase** on the product path. Employers should explore PlotOps without GitHub OAuth.

> **Superseded assumption:** shared remote `demo@` password sign-in and email/UUID `isGuestSession` detection are **retired** as the product path (see #167, ADR 0018). Optional Docker SQL seed may remain for local RLS only.

## Locked product intent (from SPEC + ADR 0018)

- Auth CTA: “Try demo” starts Guest Session lifecycle in `features/guest-mode` (no password sign-in).
- Data: product seed is TypeScript/JSON under Guest Mode; optional `supabase/seed*.sql` is Docker-only.
- Git/CI: when Guest Session active, force mock / canned seams (`features/ci-cd` mock provider, git-integration fixtures).
- Palette: narrow command set for demo (see Wave 4 note in [wave-4-plus-later.md](./wave-4-plus-later.md)).

## Assumptions (updated)

1. Guest Mode = Guest Session signal only — not a shared Auth user under RLS.
2. Demo sandbox lives in `sessionStorage`; mutations never hit Postgres on the product demo path.
3. Real authenticated users are unaffected; modes never mix.

## Implementation slices

### 1. Guest Session lifecycle (S–M)

- `features/guest-mode`: start / leave / reset; persist sandbox; export `isGuest()`.
- Auth keeps only the “Try demo” CTA that calls `startGuestSession()` (no `getGuestCredentials` / `signInWithPassword` for demo).

### 2. Seed dataset (M–L)

- Canonical product seed: TS/JSON under `features/guest-mode`.
- Optional Docker: [`supabase/seed.sql`](../../supabase/seed.sql) + [`seed-guest-dataset.sql`](../../supabase/seed-guest-dataset.sql) for local RLS — see [`docs/SUPABASE.md`](../SUPABASE.md).

### 3. Sign-in UX (S)

- [`src/features/auth/ui/login-form.tsx`](../../src/features/auth/ui/login-form.tsx): “Try demo” → Guest Session → seeded Board.
- i18n en/ru; focus-visible + mobile layout.
- Clear Guest Session when entering real GitHub/email auth.

### 4. Git & CI seams for guest (M)

- When `isGuest()`: route `features/ci-cd` through mock `buildsProvider`.
- Git tab: return fixture commits/PRs/diffs; do not call GitHub REST.

### 5. Guardrails (S)

- Hide or no-op: delete Team/Project, invites, real GitHub connect.
- TopBar / settings: show Demo chip.
- Complete-profile gate does not apply (no Supabase user; ADR 0015/0018).

### 6. Guest palette (S) — may follow immediately

- In [`src/features/command-palette/model/rules.ts`](../../src/features/command-palette/model/rules.ts): visibility helper respects guest.
- Tests in existing `rules.test.ts`.

### 7. Progress & SPEC

- Mark Progress **Guest mode** Done; move Guest-specific palette out of Deferred when done.
- Portfolio signal checklist in SPEC already lists Guest Mode.

## Key files

| Area         | Paths                                                    |
| ------------ | -------------------------------------------------------- |
| Guest module | `src/features/guest-mode/**`                             |
| Auth UI      | `src/features/auth/ui/login-form.tsx`                    |
| Docker seed  | `supabase/seed.sql`, `docs/SUPABASE.md` (local RLS only) |
| CI mock      | `src/features/ci-cd/api/mock-builds.ts`, provider seam   |
| Git          | `src/features/git-integration/**`                        |
| Palette      | `src/features/command-palette/model/rules.ts`            |

## Acceptance

- [ ] Cold visitor reaches a seeded Board via “Try demo” without Supabase Auth.
- [ ] Guest detection is Guest Session only (no email/UUID / credential helpers).
- [ ] Real users unaffected; Guest and real data stay isolated.
- [ ] Optional Docker seed must not be wired as product “Try demo”.

## Out of scope

- Deleting the remote `demo@` user from production Supabase (ops/manual).
- Per-browser durable demos across browser restarts (session-scoped by design).
- Real GitHub App install for demo.
- Wave 1+ Deferred items except guest palette narrowing.
