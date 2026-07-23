-- Allow managers to permanently delete closed/canceled sprint history
-- (and their cascaded sprint_events) for free-tier hygiene. Empty drafts
-- remain deletable as before. Active sprints cannot be deleted — cancel first.

drop policy if exists sprints_delete on public.sprints;
create policy sprints_delete on public.sprints
  for delete to authenticated
  using (
    public.can_manage_board(project_id)
    and (
      state in ('closed', 'canceled')
      or (
        state = 'draft'
        and not exists (
          select 1 from public.tasks as t where t.sprint_id = sprints.id
        )
      )
    )
  );
