# Auth identity and provider linking

PlotOps supports Google, GitHub, and email/password sign-in. Supabase stores one `auth.users` row per person and attaches multiple **Identities** when the same verified email is used across providers (automatic linking). The product must treat that as a single PlotOps account while surfacing every connected sign-in method in Settings — not a single “you signed up with Google” label.

This ADR defines the identity model, canonical GitHub fields, invite/collaborator matching, and safe link/unlink rules. Settings UI and migrations are tracked separately (#225–#227, #224).

## Motivation: collaborator self-exclusion bug

When a user signed up with Google and later linked GitHub by email, `profiles.username` could remain a Google-derived handle while their GitHub login differed. Repo collaborator suggestions matched on `profiles.username`, so the signed-in user could appear in their own invite list.

Mitigations already in code:

- `githubLoginFromUser` reads GitHub login from Auth identity metadata when GitHub is among linked providers.
- `ensureUserProfile` backfills `profiles.username` from GitHub login when they differ.
- `planCollaboratorSuggestions` excludes the current user by GitHub login (Auth metadata + live `GET /user` token probe) and by Auth email, not username alone.

Those fixes are necessary but insufficient long term: GitHub login must be persisted canonically on `profiles` (`github_login`, `github_id` — #224), and Settings must make linking explicit so users understand which methods exist and which GitHub account is bound for API access.

## Identity model

### One user, many identities

- **PlotOps account** = one `auth.users.id`, one `public.profiles` row (`profiles.id` = `auth.users.id`).
- **Identity** = one row in Supabase `auth.identities` (provider + provider subject). A user may have identities for `email`, `google`, and `github` on the same account when Supabase links them by verified email.
- **Automatic linking (Supabase default):** first sign-in with a new provider that shares a verified email merges into the existing user. PlotOps does not implement custom merge logic; we rely on Supabase Auth and expose the result in UI.
- **Explicit linking (Settings):** `linkIdentity({ provider })` adds a provider to the signed-in user when auto-link did not run (different email, user-initiated). `unlinkIdentity({ provider, identity_id })` removes one identity. Implementation: #226.

### Primary provider vs linked providers

- Supabase sets `user.app_metadata.provider` to the **first** signup provider. It does **not** change when the user signs in with another linked provider.
- Product copy and Settings must **never** infer “account type” from `app_metadata.provider` alone. Show a list of connected sign-in methods from `user.identities` (read-only v1: #225).
- **Primary provider** is informational only (first signup). It has no permission or feature effect except where Supabase session semantics require it (e.g. which `provider_token` is present on the session — see GitHub integration below).

## Profile fields: Username vs GitHub identity

| Field                   | Purpose                                                                                                                                                                      |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles.username`     | PlotOps **Username** — short handle shown in the product (`CONTEXT.md`). Often matches GitHub login but is user-editable in principle; used for display and legacy matching. |
| `profiles.github_login` | Canonical GitHub login for this account when GitHub is linked. Source of truth for repo/collaborator matching and GitHub API identity. Nullable when GitHub is not linked.   |
| `profiles.github_id`    | Stable GitHub user id (`bigint`). Preferred over login for deduplication if login is renamed on GitHub. Nullable when GitHub is not linked.                                  |

**Uniqueness (#224):** enforce `unique (github_id)` where `github_id is not null`. Do **not** unique `github_login` globally — logins can be renamed; `github_id` is the stable key. Application layer rejects linking a GitHub identity whose `github_id` already belongs to another PlotOps user (see Conflicts).

### When to sync Username from GitHub

- **On profile create:** if GitHub identity is present at first boot, set `username` to GitHub login; otherwise derive from OAuth metadata or email local-part (`ensureUserProfile` today).
- **On GitHub link or GitHub sign-in:** when `github_login` is set or updated, if `username` is empty **or** still equals a previous auto-derived value (never overwrite a deliberate user change — defer exact heuristic to #224 implementation; default: overwrite only when `username` is null/empty or matches the old `github_login`), update `username` to match `github_login`.
- **After user edits Username in Settings (future):** do not auto-overwrite `username` on subsequent GitHub sessions unless the user explicitly chooses “Sync from GitHub” (out of scope for MVP linking tickets).

Sync of `github_login` / `github_id` runs on: GitHub OAuth callback, session boot when a GitHub identity exists, and after successful `linkIdentity('github')`. Prefer GitHub `GET /user` when a valid GitHub provider token is available; fall back to identity `user_metadata.user_name` and provider subject id.

## GitHub integration vs sign-in method

GitHub serves two roles:

1. **Sign-in identity** — OAuth via Supabase; may coexist with Google/email on one account.
2. **GitHub API access** — provider token in session + client cache (`github-token`, `githubProviderTokenFromSession`) for repo list, collaborators, PRs, CI.

These are related but not identical:

- A user may sign in with **email only** and later **link GitHub** for API access without using GitHub as their daily sign-in.
- A user who signed up with **Google** may have GitHub linked; `app_metadata.provider` may remain `google` while the session carries GitHub’s `provider_token` after a GitHub sign-in — store tokens only when the token matches GitHub prefixes (`githubProviderTokenFromSession`).
- **Reconnect / token refresh** is a Settings concern (#227): re-run GitHub OAuth or sign-in with GitHub to obtain a fresh provider token; unlinking GitHub identity clears cached API token for that user.
- Required OAuth scopes for PlotOps features stay on the GitHub provider configuration; document scope changes in implementation tickets, not here.

Settings should show **Connected sign-in methods** and a separate **GitHub integration** panel (connection status, last successful API call, reconnect) so users do not confuse “I can log in with GitHub” with “PlotOps can access my repos.”

## Invite and collaborator matching

Use the following precedence when deciding “is this the same person?” or “exclude self from suggestions”:

1. **`auth.users.id`** — definitive for Team membership, invite `accepted_by` / `claimed_by`, and RLS.
2. **`profiles.github_id`** — match GitHub repo collaborators by `id` when available (API returns both `login` and `id`).
3. **`profiles.github_login`** — match collaborator `login` and GitHub-side identity; case-insensitive compare.
4. **`auth.users.email`** — Team **email** invites (ADR 0002/0003): redeem when signed-in email matches invite email; exclude self from email-targeted collaborator suggestions.
5. **`profiles.username`** — display and fuzzy hints only; **not** sufficient alone for self-exclusion or invite fulfillment (motivation above).

**Team email invites:** unchanged — email match or Owner/Admin confirm (ADR 0003). Linked Google/GitHub identities do not bypass email binding.

**Open Team invites (ADR 0019):** any signed-in non-member; identity list irrelevant except auth session must exist.

**Repo collaborator suggestions:** exclude candidates whose GitHub `login` or `id` matches the current user’s canonical GitHub fields or live token probe; exclude emails matching `auth.users.email`. Prefer `github_login` / `github_id` over `username` once #224 lands.

## Link and unlink safety

- **Minimum one sign-in method:** before `unlinkIdentity`, require at least two identities **or** a verified email/password identity that remains after unlink. Never leave the user with zero ways to sign in. Block unlink in UI with a clear error if it would violate this rule.
- **Unlink GitHub:** clear client GitHub provider token cache for that user; set `profiles.github_login` and `profiles.github_id` to null (#224). GitHub-only accounts must add email/password or another OAuth provider before unlinking GitHub.
- **Unlink Google / email:** no effect on GitHub columns unless GitHub was the only source of GitHub fields; GitHub columns reflect linked GitHub identity only.
- **Link flow:** use Supabase `linkIdentity` in an authenticated session; on success, run GitHub field sync and refresh `user.identities` in Auth state.

## Conflicts: GitHub already linked to another PlotOps user

When `linkIdentity('github')` or auto-link would attach a GitHub identity whose `github_id` (or provider subject) is already tied to a different `auth.users.id`:

- **Reject** the link; do not merge users automatically.
- Show an error: this GitHub account is already connected to another PlotOps account. Remediation: sign in to that account, unlink GitHub there (if safe), or contact support — no self-serve account merge in MVP.
- Enforce in app after OAuth callback by comparing synced `github_id` to `profiles.github_id` for other users (unique index makes races fail closed).

Same rule if two emails were used for separate accounts and the user attempts manual link — Supabase may error; surface provider message and the conflict copy above.

## Hybrid model summary

| Layer            | Behavior                                                                                           |
| ---------------- | -------------------------------------------------------------------------------------------------- |
| Supabase Auth    | Auto-link by verified email; stores identities; `linkIdentity` / `unlinkIdentity` APIs             |
| `profiles`       | Canonical `github_login` / `github_id`; Username for display                                       |
| Settings UI      | List all identities; explicit link/unlink with safety guards; GitHub integration panel (#225–#227) |
| Product features | Match collaborators/invites on user id, GitHub id/login, then email — not Username alone           |

## Consequences

- #224 adds columns and sync; collaborator filtering migrates to canonical GitHub fields.
- #225–#227 implement Settings; no link/unlink in profile name form alone.
- ADR 0003 invite confirm remains valid for email mismatch (e.g. GitHub noreply vs invite email).
- Guest Mode (ADR 0018) is unchanged — no Supabase user, no identities.

## Out of scope

- Account merge / duplicate-user admin tools
- Changing Supabase project-level “automatic linking” configuration
- Username edit UI and “Sync from GitHub” preference
- Remote migration apply (ADR 0016 — CI on merge to `main`)
