-- Several Git links per Task per Repository (ADR 0036, #352).
--
-- ADR 0035 allowed one Git link per Task × Repository. A Task often has
-- several PRs in one Repository (the fix, a hotfix, a follow-up); the second
-- one was dropped as `link_conflict`. Now:
--
--   unique (task_id, repository_id, pr_number)   one row per PR of a Task
--   unique (task_id, repository_id, branch_name) where pr_number is null
--                                                one branch-only row per branch
--
-- Existing rows already satisfy both (at most one per Task × Repository), so
-- no data moves; the reconcile check below proves no row was lost.
--
-- `update_task_details` addresses a Git link by `git_link_id`. A new id
-- creates the link with that id (the app picks it, so the optimistic row and
-- an Undo keep the same id). Without `git_link_id` it keeps the ADR 0035
-- behaviour while the Task has at most one Git link in that Repository and
-- refuses when there are several.

do $$
declare
  v_before integer;
  v_after integer;
begin
  select count(*)::integer into v_before from public.task_git_links;

  alter table public.task_git_links
    drop constraint task_git_links_task_repository_unique;

  alter table public.task_git_links
    add constraint task_git_links_task_repository_pr_unique
    unique (task_id, repository_id, pr_number);

  create unique index task_git_links_task_repository_branch_only_unique
    on public.task_git_links (task_id, repository_id, branch_name)
    where pr_number is null;

  create index task_git_links_task_id_idx on public.task_git_links (task_id);

  select count(*)::integer into v_after from public.task_git_links;
  if v_before <> v_after then
    raise exception 'git links migration: % rows after <> % before', v_after, v_before;
  end if;
end;
$$;

-- Same signature and body as 20261105120000 except the Git link block.
create or replace function public.update_task_details(
  p_task_id uuid,
  p_patch jsonb default '{}'::jsonb,
  p_label_ids uuid[] default null
)
returns void
language plpgsql
set search_path = ''
as $$
declare
  task_project uuid;
  patch jsonb := coalesce(p_patch, '{}'::jsonb);
  label_ids uuid[];
  distinct_count integer;
  matched_count integer;
  v_link_id uuid;
  v_repository_id uuid;
  v_repo_count integer;
  v_link_count integer;
  v_link public.task_git_links;
  v_found boolean := false;
  v_branch text;
  v_pr_number integer;
  v_pr_state text;
  v_pr_url text;
begin
  select t.project_id into task_project
  from public.tasks as t
  where t.id = p_task_id;

  if task_project is null then
    raise exception 'Task not found'
      using errcode = 'P0002';
  end if;

  if not public.can_edit_tasks(task_project) then
    raise exception 'Only editors can update tasks'
      using errcode = '42501';
  end if;

  if patch ? 'estimate' and not public.can_manage_board(task_project) then
    raise exception 'Only managers can edit task estimate'
      using errcode = '42501';
  end if;

  update public.tasks as t
  set
    title = case
      when patch ? 'title' then nullif(btrim(patch ->> 'title'), '')
      else t.title
    end,
    description = case
      when patch ? 'description' then patch ->> 'description'
      else t.description
    end,
    priority = case
      when patch ? 'priority' then patch ->> 'priority'
      else t.priority
    end,
    deadline = case
      when patch ? 'deadline' then nullif(patch ->> 'deadline', '')::timestamptz
      else t.deadline
    end,
    linked_commit_sha = case
      when patch ? 'linked_commit_sha' then nullif(btrim(patch ->> 'linked_commit_sha'), '')
      else t.linked_commit_sha
    end,
    task_type = case
      when patch ? 'task_type' then (patch ->> 'task_type')::public.task_type
      else t.task_type
    end,
    epic_id = case
      when patch ? 'epic_id' then nullif(patch ->> 'epic_id', '')::uuid
      else t.epic_id
    end,
    epic_color = case
      when patch ? 'epic_color' then nullif(patch ->> 'epic_color', '')
      else t.epic_color
    end,
    assignee_id = case
      when patch ? 'assignee_id' then nullif(patch ->> 'assignee_id', '')::uuid
      else t.assignee_id
    end,
    author_id = case
      when patch ? 'author_id' then nullif(patch ->> 'author_id', '')::uuid
      else t.author_id
    end,
    status = case
      when patch ? 'status' then patch ->> 'status'
      else t.status
    end,
    position = case
      when patch ? 'position' then (patch ->> 'position')::integer
      else t.position
    end,
    board_id = case
      when patch ? 'board_id' then (patch ->> 'board_id')::uuid
      else t.board_id
    end,
    estimate = case
      when patch ? 'estimate' then
        case
          when patch ->> 'estimate' is null or patch ->> 'estimate' = '' then null
          else (patch ->> 'estimate')::integer
        end
      else t.estimate
    end
  where t.id = p_task_id;

  if patch ?| array['branch_name', 'pr_number', 'pr_state', 'pr_url'] then
    v_link_id := nullif(patch ->> 'git_link_id', '')::uuid;
    v_repository_id := nullif(patch ->> 'repository_id', '')::uuid;

    if v_link_id is not null then
      select * into v_link
      from public.task_git_links as l
      where l.id = v_link_id
        and l.task_id = p_task_id;
      v_found := found;

      if v_found then
        if v_repository_id is not null and v_repository_id <> v_link.repository_id then
          raise exception 'Git link belongs to another Repository'
            using errcode = '22023';
        end if;
        v_repository_id := v_link.repository_id;
      end if;
    end if;

    if v_repository_id is null then
      select count(*)::integer, (array_agg(r.id))[1]
      into v_repo_count, v_repository_id
      from public.project_repositories as r
      where r.project_id = task_project;

      if v_repo_count <> 1 then
        raise exception 'repository_id is required when the Project has % Repositories', v_repo_count
          using errcode = '22023';
      end if;
    end if;

    -- No id: the single Git link of this Repository, as before ADR 0036.
    if v_link_id is null then
      select count(*)::integer into v_link_count
      from public.task_git_links as l
      where l.task_id = p_task_id
        and l.repository_id = v_repository_id;

      if v_link_count > 1 then
        raise exception 'git_link_id is required when the Task has % Git links in this Repository', v_link_count
          using errcode = '22023';
      end if;

      select * into v_link
      from public.task_git_links as l
      where l.task_id = p_task_id
        and l.repository_id = v_repository_id;
      v_found := found;
    end if;

    v_branch := case when patch ? 'branch_name'
      then nullif(btrim(patch ->> 'branch_name'), '') else v_link.branch_name end;
    v_pr_number := case when patch ? 'pr_number'
      then nullif(patch ->> 'pr_number', '')::integer else v_link.pr_number end;
    v_pr_state := case when patch ? 'pr_state'
      then nullif(patch ->> 'pr_state', '') else v_link.pr_state end;
    v_pr_url := case when patch ? 'pr_url'
      then nullif(patch ->> 'pr_url', '') else v_link.pr_url end;

    if v_branch is null and v_pr_number is null then
      if v_found then
        delete from public.task_git_links as l
        where l.id = v_link.id;
      end if;
    elsif v_found then
      update public.task_git_links as l
      set
        branch_name = v_branch,
        pr_number = v_pr_number,
        pr_state = v_pr_state,
        pr_url = v_pr_url
      where l.id = v_link.id;
    else
      insert into public.task_git_links (
        id, task_id, repository_id, project_id, branch_name, pr_number, pr_state, pr_url
      )
      values (
        coalesce(v_link_id, gen_random_uuid()),
        p_task_id, v_repository_id, task_project, v_branch, v_pr_number, v_pr_state, v_pr_url
      );
    end if;
  end if;

  if p_label_ids is null then
    return;
  end if;

  label_ids := coalesce(p_label_ids, '{}'::uuid[]);

  select count(*)::integer into distinct_count
  from (
    select distinct unnest(label_ids) as id
  ) as distinct_ids;

  if distinct_count <> coalesce(cardinality(label_ids), 0) then
    raise exception 'Label id list contains duplicates'
      using errcode = 'P0001';
  end if;

  select count(*)::integer into matched_count
  from unnest(label_ids) as lid(id)
  inner join public.labels as l
    on l.id = lid.id
    and l.project_id = task_project;

  if matched_count <> distinct_count then
    raise exception 'Label id list contains unknown labels'
      using errcode = 'P0001';
  end if;

  delete from public.task_labels
  where task_id = p_task_id;

  insert into public.task_labels (task_id, label_id)
  select p_task_id, lid.id
  from unnest(label_ids) as lid(id);
end;
$$;

revoke all on function public.update_task_details(uuid, jsonb, uuid[]) from public, anon;
grant execute on function public.update_task_details(uuid, jsonb, uuid[]) to authenticated;
