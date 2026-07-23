# Split tasks god-module along glossary seams

`src/features/tasks` held Board, Label, Sprint, and Task in one shallow module. We split into sibling features — `boards`, `labels`, `sprints`, `tasks` — matching CONTEXT.md and ADR-0006/0008. Dependency graph is acyclic: `labels` and `boards` are leaves; `tasks` → boards + labels; `sprints` → boards + tasks. Each module owns its React Query cache and Realtime table subscription (no shared `ProjectBoard` bag, no god `BoardProvider`). Composition lives in the board page / `widgets/kanban-board` (DnD + wiring); features do not import the widget. UI store is split the same way (selection/filters in tasks, sprint scope in sprints). Migration is incremental, leaves first, with temporary re-exports from `@/features/tasks` until callers move — then shims die.

**Rejected:** keep one aggregate cache owned by boards (faster migrate, re-glues modules); big-bang rewrite (longer red); Labels under Board (fights ADR-0006).
