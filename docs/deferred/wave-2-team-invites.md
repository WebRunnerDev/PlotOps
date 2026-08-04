# Wave 2 — Team invites & email (implementation plans)

**Size:** M each · **Order inside wave is fixed** · **Depends on:** ADR 0017 Team model (`team_invites`, Team settings).

Do not start until explicitly pulled. Prefer after Wave 1 noise settles; Guest Mode not required.

---

## 2.1 Open invite link (no email binding) — **M**

### Goal

Role + TTL link anyone can redeem — separate from email-targeted Invites (ADR 0002/0003 remain for email invites).

### Domain notes to grill

- New invite kind vs nullable `email` on `team_invites` (today `email` NOT NULL / nonempty check in migration).
- Caps: max redemptions? one-shot vs multi-use until TTL?
- Role selection at create (Contributor default?); Owner-only grant rules for Admin unchanged (ADR 0004).
- UI: Team settings “Copy open link” alongside email invite.

### Slices

1. **Schema + RLS** — migration via `npx supabase migration new`; redeem RPC validates token, TTL, membership, inserts `team_members`; exclude email uniqueness for open kind.
2. **API + hooks** — create/revoke open invite; list in Team settings.
3. **Redeem UI** — `/invite/$token` already exists; branch on invite kind (email match vs any signed-in user).
4. **i18n + tests** — SQL seam tests pattern in `supabase/tests/team_schema_test.sql`.

### Acceptance

- [ ] Signed-in user without matching email joins Team via open link within TTL.
- [ ] Expired/revoked tokens fail safely.
- [ ] Email-targeted invites unchanged.
- [ ] SPEC Deferred row cleared; ADR companion if model forks hard.

### Key files

`supabase/migrations/*team*`, `team-members-api.ts`, `team-members-settings.tsx`, `src/routes/invite.$token.tsx`.

---

## 2.2 Custom SMTP / real invite emails — **M**

### Goal

Wire Resend (or similar) when free-tier mail is not enough. Invite model stays **email-addressed**.

### Slices

1. **Provider choice + secrets** — Edge Function env (`RESEND_API_KEY`, from-address); document in `docs/SUPABASE.md` / runbook; never put keys in Vite.
2. **Send path** — on `createTeamInvite` (or DB webhook): Edge Function builds invite URL (`/invite/$token`) + email body (en/ru or single locale + app i18n link).
3. **Failure UX** — copy-link still works if mail fails (ADR 0002 posture); surface toast “email may be delayed”.
4. **Local/dev** — mock/no-op when secret missing; log invite URL.

### Acceptance

- [ ] Creating email invite triggers outbound mail in configured env.
- [ ] Copy-link path unchanged without SMTP.
- [ ] No publishable key misuse.
- [ ] SPEC Deferred row cleared.

### Out of scope

Open-link emails (2.1 has no email); custom branded templates beyond simple HTML.

---

## 2.3 GitHub collaborator auto-suggest — **M**

### Goal

On repo connect, list GH collaborators and offer “Add to Team” → existing invite/member flows.

### Prerequisites

- Open invite (2.1) optional but helpful for users without PlotOps accounts.
- SMTP (2.2) optional for email invites to non-users.
- GitHub `provider_token` already used at connect ([`add-project-dialog.tsx`](../../src/features/projects/ui/add-project-dialog.tsx)).

### Slices

1. **API** — Octokit/REST collaborators for selected repo; map logins → emails if available (GH may hide emails — degrade to “invite by GitHub username” or open link share).
2. **UI** — post-create or in-dialog step: checkbox list → bulk create email invites / skip.
3. **Dedupe** — skip existing `team_members` and pending invites.
4. **Guest / no token** — hide step.

### Acceptance

- [ ] Connecting a repo can suggest collaborators without breaking create-project happy path (skippable).
- [ ] No duplicate members.
- [ ] SPEC Deferred row cleared.

### Key files

`add-project-dialog.tsx`, GitHub client helpers under `features/projects` or `git-integration`, Team invite create APIs.

---

## Wave 2 sequencing checklist

- [ ] Pull and ship **2.1** first (pure product/RLS).
- [ ] Then **2.2** (ops).
- [ ] Then **2.3** (composes invites + GH token).
