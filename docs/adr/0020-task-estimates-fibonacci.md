# Fibonacci Estimates on Tasks (points + count)

Tasks may carry an optional Fibonacci Estimate (`1|2|3|5|8|13|21`; null = unestimated). Manager+ may set/clear via drawer (DB-enforced on `update_task_details` and `BEFORE UPDATE OF estimate`). Contributor still edits other Task fields. Sprint Active badges and Close reports show points sum (and unestimated count) as primary size signal while keeping task-count secondary — Commitment/completion membership stays task-id based.

Burndown (wave 3.4) prefers points when any in-scope Estimate exists, otherwise task count. Daily remaining is reconstructed client-side from Commitment + `sprint_events` (no daily snapshot table on Free). Active remaining uses current Done columns as a proxy; Closed remaining drops `completed_task_ids` on/after Close day. Velocity KPIs remain deferred (wave 3.5).
