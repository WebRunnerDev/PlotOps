# Board move Notifications coalesce status remap

Moving a Task to another Board updates `board_id` and remaps `status` in one write. Recipients get a single `board_move` Notification (Boards and status in metadata), not a separate `status_change` for that remap. Same-Board column moves still produce only `status_change`. Avoids double fan-out and double Realtime per Watcher on every Board move.

**Rejected:** emit both kinds; emit `status_change` only when the remapped column name differs from the source (hard to explain and easy to get wrong).
