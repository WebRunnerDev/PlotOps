# Open Team invites (no email binding)

Team invites may be `kind = open`: a Role + TTL link that any signed-in non-member can redeem. Open invites stay `pending` until revoke/expire and track usage via `redeem_count` (no redemption cap in MVP). Email-targeted invites (`kind = email`) keep ADR 0002 / 0003 semantics (copy-link delivery; accept on email match or Owner/Admin confirm). Claim/confirm are rejected for open invites. Admin role on create remains Owner-only (ADR 0004).
