# Wave 2 — Infrastructure runbook

Ops checklist for PlotOps remote project **`ijcelrdcygzyzhcijkhe`**. Code-side items (CI advisors, local MFA config) ship in-repo; Dashboard steps below require a human with **Owner/Admin** on the Supabase org/project.

**Parent plan:** [`hardening-plan.md`](hardening-plan.md) → Wave 2.

---

## Status tracker

| Item                         | Repo / CI                      | Remote Dashboard (ops)           |
| ---------------------------- | ------------------------------ | -------------------------------- |
| Security Advisor in CI       | ✅ PR + post-migrate on `main` | Re-run Advisor after ops changes |
| Network Restrictions         | —                              | ☐                                |
| SSL enforcement              | —                              | ☐                                |
| MFA on Supabase org accounts | —                              | ☐                                |
| Custom SMTP (auth emails)    | —                              | ☐                                |
| MFA for app users (TOTP)     | ✅ Local `config.toml`         | ☐ Enable + optional app UI later |

---

## 1. Security Advisor in CI / pre-release

**Done in repo:**

- **PR gate** — [`.github/workflows/supabase-migrate-check.yml`](../../.github/workflows/supabase-migrate-check.yml) runs `supabase db advisors --local --type security --fail-on error` after `db reset` when migration paths change.
- **Post-migrate** — [`.github/workflows/supabase-migrate.yml`](../../.github/workflows/supabase-migrate.yml) runs `supabase db advisors --linked --type security --fail-on error` after `db push` on `main`.
- **Local:** `npm run db:advisors` (Docker stack must be running). Linked remote: `npm run db:advisors:remote` (requires `supabase link` + login).

**Manual gate (optional):** before a release, open Dashboard → **Database → Security Advisor** and compare to [`advisor-triage-2026-08-31.md`](advisor-triage-2026-08-31.md). CI fails only on **ERROR** level; **WARN** (e.g. accepted RLS helper EXECUTE) still need periodic human review.

---

## 2. Network Restrictions

**Purpose:** Limit direct Postgres / pooler connections to known IP ranges. Reduces exposure if database credentials leak.

**Does not block:** HTTPS APIs (Auth, PostgREST, Storage, Realtime) or `supabase-js` — the SPA keeps working.

**Does block:** Direct `psql`, some CLI paths (`db push` uses Postgres). Plan allowlist **before** tightening.

### PlotOps considerations

| Client                                        | Needs direct Postgres? | Action                                                                  |
| --------------------------------------------- | ---------------------- | ----------------------------------------------------------------------- |
| Browser app (`supabase-js`)                   | No                     | Unaffected                                                              |
| Edge Functions (`supabase-js` + service role) | No                     | Unaffected                                                              |
| GitHub Actions `migrate` job (`db push`)      | **Yes**                | Whitelist runner egress IP or use emergency laptop push from a known IP |
| Local dev (`db:status`, emergency `db:push`)  | **Yes**                | Whitelist home/office IP                                                |

GitHub-hosted runners use **dynamic IPs** — strict allowlists can break CI. Options:

1. **Conservative:** Enable restrictions with your static dev IP only; run migrations from laptop when CI cannot connect (document in team).
2. **Stricter:** Self-hosted runner with static IP in allowlist.
3. **Defer** until static egress is available.

### Dashboard

1. [Database Settings → Network Restrictions](https://supabase.com/dashboard/project/ijcelrdcygzyzhcijkhe/database/settings#network-restrictions)
2. Add IPv4 CIDRs for trusted locations (e.g. `203.0.113.10/32` for one machine).
3. If the project resolves IPv6 for direct connections, add matching IPv6 CIDRs.
4. Save → verify CI migrate still succeeds (or document fallback).

### CLI (alternative)

```bash
npx supabase login
npx supabase network-restrictions get --project-ref ijcelrdcygzyzhcijkhe --experimental
# Append a dev IP without replacing existing rules:
npx supabase network-restrictions update --project-ref ijcelrdcygzyzhcijkhe \
  --db-allow-cidr YOUR.IP.ADDR/32 --append --experimental
```

Docs: [Network Restrictions](https://supabase.com/docs/guides/platform/network-restrictions).

---

## 3. SSL enforcement

**Purpose:** Reject non-SSL direct Postgres / pooler connections.

**Does not block:** HTTP APIs (already SSL). SPA unaffected.

**Caution:** Enabling triggers a **brief database reboot** (seconds to minutes by size).

### Dashboard

1. [Database Settings → SSL Configuration](https://supabase.com/dashboard/project/ijcelrdcygzyzhcijkhe/database/settings#ssl-configuration)
2. Enable **Enforce SSL on incoming connections**.
3. For manual `psql` / tools, download the project CA cert and use `sslmode=verify-full`.

### CLI

```bash
npx supabase ssl-enforcement --project-ref ijcelrdcygzyzhcijkhe get --experimental
npx supabase ssl-enforcement --project-ref ijcelrdcygzyzhcijkhe update --enable-db-ssl-enforcement --experimental
```

Docs: [Postgres SSL Enforcement](https://supabase.com/docs/guides/platform/ssl-enforcement).

---

## 4. MFA on Supabase org accounts

**Purpose:** Protect Dashboard / org admin access (project settings, secrets, migrations visibility).

### Per-user MFA

1. Each maintainer: [Account → Security](https://supabase.com/dashboard/account/security) → enable TOTP (authenticator app).
2. If signing into Supabase via **GitHub**, also enable [GitHub 2FA](https://docs.github.com/en/authentication/securing-your-account-with-two-factor-authentication-2fa).

### Org enforcement (Pro+)

1. [Organization → Security](https://supabase.com/dashboard/org/_/security) → **MFA enforcement** for all org members.
2. Add a **second Owner** on [Organization → Team](https://supabase.com/dashboard/org/_/team) so one locked account does not block the org.

Docs: [Platform MFA](https://supabase.com/docs/guides/platform/multi-factor-authentication), [Org MFA enforcement](https://supabase.com/docs/guides/platform/mfa/org-mfa-enforcement).

---

## 5. Custom SMTP for auth emails

**Purpose:** Auth emails (confirm signup, magic link, password reset) from a **trusted domain**; higher send limits than built-in SMTP.

PlotOps already uses **Resend** for team invites (`send-team-invite` Edge Function). Auth SMTP is a **separate** Dashboard setting (GoTrue), but you can use the same provider/domain.

### Dashboard

1. [Authentication → Emails → SMTP Settings](https://supabase.com/dashboard/project/ijcelrdcygzyzhcijkhe/auth/smtp)
2. Enable custom SMTP. Example for Resend:
    - Host: `smtp.resend.com`
    - Port: `465` (SSL) or `587` (STARTTLS)
    - User: `resend`
    - Password: Resend API key (`re_...`)
    - Sender: verified domain, e.g. `PlotOps <auth@yourdomain.com>`
3. Send a test email from the Dashboard.
4. **Disable link tracking** in Resend (or provider) so confirmation links are not rewritten.
5. Review **Authentication → Rate Limits** — custom SMTP raises the default auth email cap (see [Production checklist](https://supabase.com/docs/guides/deployment/going-into-prod#rate-limiting-resource-allocation--abuse-prevention)).

### Local dev

Local stack uses `[local_smtp]` (Inbucket on `:54324`) — no remote SMTP needed for Docker. Uncomment `[auth.email.smtp]` in `supabase/config.toml` only if testing real SMTP locally.

Docs: [Auth SMTP](https://supabase.com/docs/guides/auth/auth-smtp).

---

## 6. MFA for app users (TOTP)

**Purpose:** Optional second factor for PlotOps **end users** (not org admins). Requires **Pro** plan for remote.

### Remote Dashboard

1. [Authentication → Multi-Factor Authentication](https://supabase.com/dashboard/project/ijcelrdcygzyzhcijkhe/auth/mfa)
2. Enable **App Authenticator (TOTP)** — enroll + verify.
3. Leave phone/WebAuthn disabled unless product needs them.

### Local (repo)

`supabase/config.toml` mirrors remote with `[auth.mfa.totp] enroll_enabled = true` and `verify_enabled = true`. Restart stack after changes: `npm run db:stop && npm run db:start`.

### App UI (deferred)

Enabling MFA server-side does not enroll users. A future feature adds:

- Settings → enroll / unenroll TOTP (`supabase.auth.mfa.enroll`, `listFactors`, `unenroll`)
- Login challenge step when `aal1` session needs `aal2` (`mfa.challenge`, `mfa.verify`)
- Optional restrictive RLS for users who opted in (see [Auth MFA guide](https://supabase.com/docs/guides/auth/auth-mfa))

Wave 2 scope is **infrastructure enablement**; UI is not required to mark Dashboard steps complete.

---

## Verification checklist (after all ops steps)

- [ ] `migrate` GitHub Action still succeeds (or documented manual path).
- [ ] Sign-up confirmation email arrives from custom domain (not `@mail.app.supabase.io`).
- [ ] Security Advisor: no new **ERROR** rows; WARN count documented in [`advisor-triage-2026-08-31.md`](advisor-triage-2026-08-31.md).
- [ ] All org maintainers confirmed MFA enabled.
- [ ] Update status table at top of this file (change ☐ → ✅).
