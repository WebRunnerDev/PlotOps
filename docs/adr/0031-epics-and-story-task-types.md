# Jira-like Task types: Epic and Story

PlotOps adopts the Jira hierarchy: **Epic** (level 1) groups **Story / Task / Bug** (level 0); a **Subtask** is any level-0 type with a Parent Task. `task_type` becomes `epic | story | task | bug` — `feature` is renamed to `story` in place (existing `FEAT-n` keys stay; new keys are `EPIC-n` / `STORY-n`). Supersedes ADR 0023's "No Epic type".

## Decision

- **An Epic is a Task** (`task_type = 'epic'`), not a separate table — it reuses description, comments, Watchers, Activity, Labels, mentions, archive. It lives on one Board (created on the current Board) and takes its status from that Board's columns.
- **Membership is `tasks.epic_id`**, not a second `parent_id` level. Parent/Subtask gates (Done, Sprint inheritance, Subtask visibility) stay untouched. `epic_id` is only on root non-Epic Tasks, same Project, any Board; Subtasks inherit their Parent's Epic. Deleting an Epic sets members' `epic_id` to null.
- **Epics carry no Parent, Subtasks, Sprint, Estimate, or branch/PR.** Size is the rollup of members (`project_epics` RPC: count, Done, points). Closing an Epic with open members is allowed (Jira-like) — no Done gate.
- **Enforced in `assert_task_epic_rules`** (and mirrored in Guest via `lib/epic-rules.ts`). Converting to / from Epic is Manager+ (root Epic insert is already Manager+ via RLS); an Epic with members cannot change type; a Parent Task, Subtask, or Sprint member cannot become an Epic. Promoting a Story drops its own `epic_id`; becoming a Subtask drops `epic_id`.
- **UI:** Epics are hidden from Kanban columns and Backlog lists; Backlog has an Epics panel (progress, click-to-filter, drop Tasks to add, Manager+ create). Cards and rows show an Epic chip (own or Parent's); Board/Backlog filters gain an Epic facet. Epic drawer shows colour, rollup Estimate, and "Tasks in this epic". Boards cannot default to Epic.

## Rejected

- Separate `epics` table — duplicates every Task surface (comments, Watchers, Activity) for little gain.
- Two-level `parent_id` (Epic → Story → Subtask) — would drag Epics into Parent Done gates, Subtask Sprint inheritance, and Subtask visibility.
- Keeping `feature` beside `story` — two names for the same Jira concept.
- Hard Done gate on Epics — Jira lets Epics close with open issues; a warning-free close keeps planning flexible.
- Project-level Epics without a Board — every Task belongs to exactly one Board; an Epic needs a status workflow.
