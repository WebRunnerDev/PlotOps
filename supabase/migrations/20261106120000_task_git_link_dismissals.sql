-- Auto-link remembers manual unlinks (ADR 0035 «Auto-link», #351).
--
--   task_git_link_dismissals   a branch or PR a person removed from a Task's
--                              Git link; auto-link never puts it back there.
--
-- Written only by the trigger below: a signed-in user (auth.uid() set) who
-- removes a branch / PR from a Git link dismisses it; the same user putting
-- it back (Undo, manual relink) lifts the dismissal. The webhook and the
-- backfill run as service role (auth.uid() null) and never touch this table
-- through the trigger.

create table public.task_git_link_dismissals (
  id uuid primary key default gen_random_uuid(),
  task_id uuid not null references public.tasks (id) on delete cascade,
  repository_id uuid not null references public.project_repositories (id) on delete cascade,
  -- Denormalised from the Git link for RLS.
  project_id uuid not null references public.projects (id) on delete cascade,
  kind text not null,
  -- Branch name, or the PR number as text.
  value text not null,
  dismissed_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  constraint task_git_link_dismissals_kind_known check (kind in ('branch', 'pr')),
  constraint task_git_link_dismissals_unique unique (task_id, repository_id, kind, value)
);

create index task_git_link_dismissals_repository_idx
  on public.task_git_link_dismissals (repository_id);
create index task_git_link_dismissals_project_id_idx
  on public.task_git_link_dismissals (project_id);

alter table public.task_git_link_dismissals enable row level security;

-- Viewers may read (like task_git_links); nobody writes directly.
create policy task_git_link_dismissals_select_member
  on public.task_git_link_dismissals for select to authenticated
  using (public.can_view_project(project_id));

revoke all on public.task_git_link_dismissals from anon, authenticated;
grant select on public.task_git_link_dismissals to authenticated;
grant select, insert, update, delete on public.task_git_link_dismissals to service_role;

create or replace function public.task_git_links_remember_unlink()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := auth.uid();
  v_task uuid;
  v_repository uuid;
  v_project uuid;
  v_old_branch text;
  v_old_pr integer;
  v_new_branch text;
  v_new_pr integer;
begin
  -- Webhook / backfill (service role): automatic changes are not dismissals.
  if v_user is null then
    return null;
  end if;

  if tg_op = 'DELETE' then
    v_task := old.task_id;
    v_repository := old.repository_id;
    v_project := old.project_id;
  else
    v_task := new.task_id;
    v_repository := new.repository_id;
    v_project := new.project_id;
  end if;

  if tg_op in ('UPDATE', 'DELETE') then
    v_old_branch := old.branch_name;
    v_old_pr := old.pr_number;
  end if;

  if tg_op in ('INSERT', 'UPDATE') then
    v_new_branch := new.branch_name;
    v_new_pr := new.pr_number;
  end if;

  -- A cascade (Task, Repository or Project deleted) is not an unlink.
  if not exists (select 1 from public.tasks as t where t.id = v_task)
    or not exists (
      select 1 from public.project_repositories as r where r.id = v_repository
    ) then
    return null;
  end if;

  if v_old_branch is not null and v_old_branch is distinct from v_new_branch then
    insert into public.task_git_link_dismissals (
      task_id, repository_id, project_id, kind, value, dismissed_by
    )
    values (v_task, v_repository, v_project, 'branch', v_old_branch, v_user)
    on conflict on constraint task_git_link_dismissals_unique do nothing;
  end if;

  if v_old_pr is not null and v_old_pr is distinct from v_new_pr then
    insert into public.task_git_link_dismissals (
      task_id, repository_id, project_id, kind, value, dismissed_by
    )
    values (v_task, v_repository, v_project, 'pr', v_old_pr::text, v_user)
    on conflict on constraint task_git_link_dismissals_unique do nothing;
  end if;

  if v_new_branch is not null and v_new_branch is distinct from v_old_branch then
    delete from public.task_git_link_dismissals as d
    where d.task_id = v_task
      and d.repository_id = v_repository
      and d.kind = 'branch'
      and d.value = v_new_branch;
  end if;

  if v_new_pr is not null and v_new_pr is distinct from v_old_pr then
    delete from public.task_git_link_dismissals as d
    where d.task_id = v_task
      and d.repository_id = v_repository
      and d.kind = 'pr'
      and d.value = v_new_pr::text;
  end if;

  return null;
end;
$$;

revoke all on function public.task_git_links_remember_unlink() from public, anon, authenticated;

create trigger task_git_links_remember_unlink
  after insert or update or delete on public.task_git_links
  for each row
  execute function public.task_git_links_remember_unlink();
