# Only Owner may grant or revoke Admin

Admins may invite and assign Manager, Contributor, or Viewer, but cannot promote anyone to Admin or demote an Admin. That keeps a single trust root on `projects.owner_id` and prevents Admin privilege sprawl among close collaborators.
