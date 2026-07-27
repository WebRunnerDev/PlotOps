# Notifications are fan-out rows, not derived Activity

In-app Notifications need per-user unread state, a global inbox with Project filter/search, and Watch-scoped status events plus always-on assignment events. We persist one `notifications` row per recipient at write time (fan-out), excluding the actor, instead of deriving the inbox by joining `activity_log` with Watches and read receipts. Fan-out keeps Mark-all-read, badges, and search simple; volume stays small because MVP only fans out status and assignment. Retention policy: read rows may be purged after 30 days; unread rows may be kept up to 90 days, then deleted. Activity remains the shared Task-drawer feed and is not the inbox.

**Rejected:** derive-on-read from `activity_log` + Watches (fewer writes, but unread/search and “assignment without Watch” get awkward); reuse `activity_log` as the inbox (no Watch, wrong privacy/shape).
