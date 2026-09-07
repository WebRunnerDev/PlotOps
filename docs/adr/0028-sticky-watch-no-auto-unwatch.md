# Sticky Watch — no auto-Unwatch on stake loss

Losing Author or Assignee no longer removes that user's Watch. Manual Unwatch (self or via Manage Watchers) sticks while the user still holds Author/Assignee; auto-enroll runs again only when Author/Assignee is set onto them again (including transfer/reassign) or when they create a Comment. Clearing Assignee always-on notifies the previous Assignee and fans out to Watchers. This supersedes ADR 0012 and matches Jira-like sticky watching.

**Rejected:** re-auto-enroll Author/Assignee on every Task edit; forbidding Unwatch while Author/Assignee; keeping auto-Unwatch when neither stake remains.
