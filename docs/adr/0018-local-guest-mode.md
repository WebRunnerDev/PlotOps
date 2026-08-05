# Local Guest Mode (no shared demo account)

Guest Mode is a **fully client-side** sandbox: the visitor starts a Guest Session from “Try demo” without Supabase Auth or Postgres/Realtime. Demo data lives in `sessionStorage`, clears on Leave demo / Reset demo / end of the browser session, and is served through provider adapters (same pattern as CI/git fixtures). This reverses Wave 0’s shared `demo@plotops.app` account so portfolio traffic cannot pollute or burn remote quotas.

## Considered options

- **Shared remote demo user (Wave 0)** — real `signInWithPassword`, shared rows, mutation pollution; rejected for quota/abuse and shared-state mess.
- **Hybrid** — still Auth sign-in, local task/sprint store; rejected because Auth login still costs quota and forgot hooks easily write remote.
- **Per-browser local sandbox (chosen)** — zero Supabase for Guest; product seed is TS/JSON in `features/guest-mode`; optional SQL seed may remain for local Docker only, not the product path.

## Consequences

- ADR 0015’s “demo Guest skips complete-profile” becomes “Guest Session has no Supabase user, so the gate does not apply.”
- Product must not expose remote demo credentials as “Try demo.”
- Write surface is happy-path only; Awareness (Activity/Notifications) stays static from seed.
