# Manage Watchers by Role and Comment-create auto-enroll

Owner, Admin, Manager, and Contributor may add or remove Watches for any Team Member who can view the Task (including Viewer). Viewer may only Watch/Unwatch themselves. Creating a Comment auto-enrolls the commenter as a Watcher (no personal pref UI); editing a Comment does not enroll and creates no Watcher Notification. Mentionees are not auto-enrolled by Mention alone. When a Comment or Description save also adds Mentions, Mentionees receive only `mention`; other Watchers receive `comment` or `description_change`. Guest Mode mirrors the same kinds and auto-enroll rules in the sandbox (no multi-user manage).

**Rejected:** Contributor-only or Admin-only manage lists; Viewer managing others; auto-enroll on Comment edit; Mentionee auto-Watch; personal “Watch your work items” preference in this change; Mentionee receiving both `mention` and `comment`/`description_change` for the same save.
