# Custom text fields are Project-scoped and Task-type filtered

PlotOps needs optional per-Project text metadata on Tasks (e.g. bug repro steps) without inventing Board-specific schemas, without showing bug-only fields on plain Tasks, and without burning Free-tier storage on soft-deleted definitions.

## Decision

- **Scope = Project**, same boundary as Labels. Definitions live on the Project. Board move keeps values — no remap.
- **Visibility = Task type.** Each definition declares which built-in Task types it applies to (`task` / `bug` / `feature`; at least one). The Task drawer shows only fields whose `applies_to` includes the Task’s current type. Example: “Steps to reproduce” → `bug` only — not shown on a plain `task`.
- **Type change:** values are **kept** when the Task type changes; fields that no longer apply are hidden, not deleted. Switching back restores the previous text. Orphan values for non-applicable types are fine until the definition is deleted.
- **Non-dev / no-Git work** uses a **name-only Project** under the Team (#175), not a “special” Board with a different field schema. A second Board in an eng Project still shares Labels and custom fields; that is intentional.
- **MVP type is text only.** Add / rename / reorder / delete definitions and edit `applies_to` in Project Settings (Manager+). Cap **≤10** definitions per Project (DB-enforced). Values edited in the Task drawer (Contributor+), not shown as Kanban card chips in MVP. Plain-text values capped at **8192** characters (UI counter + DB check).
- **Built-in Description.** Every Project has a non-deletable `system_key = 'description'` definition (not counted toward the 10). Rename, `applies_to`, and reorder work like other fields; body values stay on `tasks.description` (rich text). Cannot transfer or store EAV values for system fields.
- **Storage:** `custom_field_definitions` (+ `applies_to` as `task_type[]` or equivalent check) + `task_custom_field_values` (EAV). Delete definition → cascade values (hard delete). No soft-archive of definitions.
- **Transfer:** copy a definition (name, position, `applies_to`) into another Project the actor can manage — same UX idea as Label transfer. Does **not** copy Task values.
- **Activity:** value changes may be logged like other short Task fields when the feature ships; definition CRUD stays Settings-only.
- **Out of MVP:** number/select/date types, required fields, board filters/sort by custom field, card chips, Watcher notifications for custom-field edits, user-defined Task types beyond the fixed enum, Guest seed beyond a tiny optional demo stub.

## Rejected

- **Show every Project field on every Task** — clutters the drawer; bug-only fields (repro steps) do not belong on a plain Task.
- **Board-scoped definitions** — Tasks move between Boards; shared Labels already imply Project schema; Board fields would duplicate Labels’ boundary and complicate transfer.
- **Soft-archive definitions** — keeps rows (+ values if orphaned) forever on Free tier with little product gain; hard delete + confirm when values exist is enough.
- **JSON blob on `tasks`** — harder to enforce cap/uniqueness, delete one field cleanly, and RLS/transfer; EAV matches Labels/`task_labels`.
- **Clear values on type change** — loses data when someone flips type by mistake; hide + keep is enough for MVP.
- **Kanban chips in MVP** — drawer is enough; card density already high (Labels, Priority, Parent, blockers).
