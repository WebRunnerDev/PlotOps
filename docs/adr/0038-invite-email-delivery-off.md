# Invite email delivery is off in production

ADR 0002 made the copied link the primary way to deliver a Team invite and left email as a later add-on. `send-team-invite` can send through Resend, but production has no Resend account, verified sending domain or `RESEND_API_KEY` / `INVITE_FROM_EMAIL` / `INVITE_APP_ORIGIN` (audit 2026-11-25, OPS-21, issue #415). Until now nothing said whether that was a gap or a choice, and the invite form told people an email "is sent when outbound mail is configured".

## Decision

- Invite email stays **off**. An email-kind invite is still addressed to one email (sign-up must use it) and is delivered by the link the form copies.
- The client still calls `send-team-invite` after an email-kind invite. With no Resend secrets it answers `{ skipped: true }`, and the inviter sees _PlotOps doesn't send invite emails — share the copied link_. Setting the three secrets turns email on with no code change.
- `scripts/edge-secrets.ts` lists the three secrets as an optional feature: all unset passes, all set passes, a partial set fails the `edge-secrets` release check (a half set returns `origin_required`).

## Rejected

- **Turn on Resend now.** Needs an account and a verified sending domain for a small team that already shares links in chat.
- **Supabase Auth SMTP.** About 2 messages an hour (ADR 0002).
- **Hide the Email invite mode.** The mode is what binds an invite to one address; only the delivery is missing.
