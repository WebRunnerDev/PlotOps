# Waves 4+ — Later pulls only

Explicit product pull required. Do not start from opportunistic cleanup. Sizes and planning depth below.

Index: [README.md](./README.md).

---

## Wave 4 — Awareness depth

**After:** Mentions MVP stable (Progress Mentions 🟡 polish). Sprint Wave 3 not required except where noted.

| Item                                      | Size    | Own plan              | Notes                                                                             |
| ----------------------------------------- | ------- | --------------------- | --------------------------------------------------------------------------------- |
| Group Mentions (`@everyone` / Roles)      | **M–L** | yes — expand ADR 0014 | Resolve Mentionees from Team membership; fan-out volume + Free-tier; editor chips |
| Comment events without Mention            | **M**   | yes                   | Plain Comments as Notification kind (Watch vs always-on); volume policy           |
| Palette: Search Task description / Labels | **M**   | light                 | FTS/`ilike` cost on Free; after awareness polish ok                               |
| Guest-specific palette behaviour          | **S**   | no                    | **After Wave 0**; see [wave-0-guest-mode.md](./wave-0-guest-mode.md) §6           |

### Group Mentions — plan stub (expand when pulled)

1. Domain: `@everyone` = all Team members on Project’s Team; `@role:Manager` etc.; stale group mention rendering.
2. Extract pipeline treats group nodes → expand to user ids at save; RPC dedupe.
3. Picker UI + ADR 0014 amendment.
4. Inbox copy; rate limits if needed.

### Comment-without-Mention — plan stub

1. Grill Watch vs always-on to Author/Assignee/Watchers.
2. Fan-out on `task_comments` insert; exclude actor; no description of body in notification (link only).
3. Inbox formatting; Realtime already on `notifications`.

---

## Wave 5 — Org topology

| Item                                | Size     | Own plan          | Notes                                                                                                                                    |
| ----------------------------------- | -------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Merge / move Projects between Teams | **L–XL** | yes + **new ADR** | After Wave 2 stable. Unique `(team_id, github_repo_id)`; membership does not move people; boards stay under Project IDs; RLS audit heavy |

### Plan stub

1. Grill: move only vs Team merge; who can initiate (Owner both sides?).
2. RPC transaction: reassign `projects.team_id`, conflict checks, activity.
3. UI in Team/Project settings; confirm dangers.
4. Tests: SQL + e2e critical path.

Low portfolio demo value — pull only with real org pain.

---

## Wave 6 — Permission platform (expensive)

**Stance:** leave until Team Role model hurts for multi-board orgs. If anything, Assigned-only before Board overrides.

| Item                                 | Size   | Own plan  | Notes                                                                                   |
| ------------------------------------ | ------ | --------- | --------------------------------------------------------------------------------------- |
| Assigned-only Contributor edits      | **M**  | yes       | Was **rejected for MVP**; RLS + every mutation path (`use-board-tasks`, comments, etc.) |
| Board-level permission overrides     | **XL** | yes + ADR | Breaks “Team Role applies everywhere”; policies explode                                 |
| Granular permission flags per Member | **XL** | yes + ADR | Capability matrix; cognitive load vs roles                                              |

### Assigned-only stub

1. Reopen product decision explicitly (SPEC currently rejected).
2. Policy: Contributor may update Task iff `assignee_id = auth.uid()` (or Author? grill).
3. UI gating via `useTeamAccess` + server RLS proof tests.

### Board overrides / granular flags stub

1. New tables + capability helpers; migrate all RLS to capability functions.
2. Settings UI; Viewer stay read-only elsewhere.
3. Phased rollout Board-by-Board.

---

## Wave 7 — GitHub write API

| Item                            | Size  | Own plan | Notes                                                                                                   |
| ------------------------------- | ----- | -------- | ------------------------------------------------------------------------------------------------------- |
| In-app Open PR + Merge          | **M** | ADR 0022 | ✅ Shipped — client `provider_token`; Owner/Admin any; Manager/Contributor author\|assignee; guest hide |
| In-app Approve / request review | **M** | yes      | Parked — same token + UI confirmations; not in Open+Merge MVP                                           |

### Prerequisites (done for Open+Merge)

- Git integration Progress closed (diff/link solid).
- Guest uses mocks — write actions hidden for guest.

### Remaining (Approve)

1. Product: approve vs request review only.
2. UI confirmations; map GH review API errors to i18n.
3. Keep webhook as source of truth for Task column on merge.

---

## Parked — Figma Make board chrome

Not scheduled. Treat as product invention, not “finish Make redesign” (ADR 0007).

| Item                       | Size if ever | Own plan                         |
| -------------------------- | ------------ | -------------------------------- |
| **Group by** board control | **L**        | yes — aggregation model          |
| **Display** board control  | **M–L**      | yes — density/fields preferences |

Already rejected / done elsewhere: Make dock nav, Cmd+K placement, two-column drawer, DIFF PREVIEW sections — see SPEC Deferred from Figma Make.

---

## Explicit-pull gate

Before opening any Wave 4–7 issue:

1. Confirm pain in product/Notion or user request.
2. Copy the relevant stub into a focused issue or grilling doc.
3. Do not mix permission/platform work with Guest or palette polish PRs.
