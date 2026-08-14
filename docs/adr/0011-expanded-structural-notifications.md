# Expanded structural Notifications keep fan-out and Realtime

Watch now covers a curated set of structural Task events (status, Board move, Priority, Assignee set/reassign, Author change, and Subtask created/closed on a watched Parent Task — `subtask_change`, ADR 0023), plus always-on delivery to the new Assignee and new Author — not every Activity. We keep write-time fan-out rows and Realtime on `notifications` (ADR 0010). Free-tier volume is controlled by that curated set, Board-move coalesce (ADR 0013), always-on/Watcher dedupe, and existing 30/90-day retention — not by derive-on-read, mute-per-kind settings, or dropping Realtime.

**Rejected:** broaden Watch to Labels/Sprint/git/description/archive; per-kind mute UI; digest/summary rows instead of one Notification per changed kind; polling-only inbox to save Realtime messages (revisit if org quota becomes tight). Mentions/comments are deferred.
