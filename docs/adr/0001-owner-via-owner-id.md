# Project Owner is `owner_id`, not a Member role

Access is modeled with `project_members` roles (Admin, Manager, Contributor, Viewer), but Project ownership stays on `projects.owner_id` only — there is no `owner` row in `project_members`. This avoids dual sources of truth and keeps ownership transfer as a single column update. The Owner still appears in the members UI via a join with `profiles`.
