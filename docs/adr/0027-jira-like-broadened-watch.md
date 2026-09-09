# Jira-like broadened Watcher Notifications

Watch covers a broadened Jira-like set of Task events — existing structural kinds plus Comment create, title, description, Labels, Estimate, Sprint membership, and Assignee clear — with write-time fan-out and Realtime unchanged (ADR 0010). Volume is controlled by explicit exclusions (archive/restore, git fields, custom fields, Task type, Comment edit), Board-move coalesce (ADR 0013), always-on/Watcher and Mention/`comment`/`description_change` dedupe, and existing retention — not by the old curated-only allowlist. Each new field event is its own Notification kind (not a generic `field_change`). This supersedes ADR 0011's curated-set boundary.

**Rejected:** literal Jira notification schemes, email/batching, hotkey `W` / palette Watch toggle in this change; broadening to archive/git/custom fields/Task type; Comment-edit Watcher Notifications; per-kind mute UI; digest/summary rows.
