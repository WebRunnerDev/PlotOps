# Team is the access boundary above Project

Collaboration, membership, Roles, Invites, and ownership live on **Team** (`teams.owner_id`, `team_members`, `team_invites`). Every Project belongs to exactly one Team; access to Projects is inherited from Team membership — there is no Project-level membership overlay. Boards, Tasks, Labels, Sprints, and the linked GitHub repo stay Project-scoped (ADR 0006 unchanged). Create Project: Owner/Admin; delete Project: Owner only; delete Team only when it has zero Projects. Migration from the Project-as-boundary MVP is 1:1 (each existing Project becomes its own Team).

**Supersedes** ADR 0001’s ownership-on-`projects.owner_id` stance (Owner moves to `teams.owner_id`). Leave/removal and invite-confirm rules from ADR 0002–0005 keep the same semantics, scoped to Team.
