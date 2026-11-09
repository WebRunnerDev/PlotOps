-- #360: a Project is private when at least one of its linked Repositories is.
-- Visibility is stored per Repository; `projects.is_private` is kept in step
-- by a trigger on link, unlink and change, so unlinking the last private
-- Repository clears the Project's lock.

alter table public.project_repositories
  add column is_private boolean not null default false;

-- Backfill from the Project. Exact for one-Repository Projects (visibility was
-- set from that repo); for a private multi-repo Project every repo is marked
-- private, which keeps today's lock until its repos are relinked.
update public.project_repositories as r
set is_private = p.is_private
from public.projects as p
where p.id = r.project_id
  and p.is_private;

-- Recompute `projects.is_private` from the Project's Repositories.
create or replace function public.project_repositories_sync_project_privacy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project_ids uuid[];
begin
  if tg_op = 'INSERT' then
    v_project_ids := array[new.project_id];
  elsif tg_op = 'DELETE' then
    v_project_ids := array[old.project_id];
  else
    v_project_ids := array[old.project_id, new.project_id];
  end if;

  -- A deleted Project is gone from `projects`; the update is a no-op then.
  update public.projects as p
  set is_private = exists (
    select 1
    from public.project_repositories as r
    where r.project_id = p.id
      and r.is_private
  )
  where p.id = any (v_project_ids)
    and p.is_private is distinct from exists (
      select 1
      from public.project_repositories as r
      where r.project_id = p.id
        and r.is_private
    );

  return null;
end;
$$;

revoke all on function public.project_repositories_sync_project_privacy() from public;

create trigger project_repositories_sync_project_privacy
  after insert or delete or update of is_private, project_id
  on public.project_repositories
  for each row
  execute function public.project_repositories_sync_project_privacy();

-- Create Project: each Repository carries its own `is_private`. A client that
-- does not send it yet falls back to `p_is_private`, so the Project keeps the
-- visibility it asked for.
create or replace function public.create_project_with_repositories(
  p_team_id uuid,
  p_name text,
  p_slug text,
  p_description text default null,
  p_is_private boolean default false,
  p_repositories jsonb default '[]'::jsonb
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_project_id uuid;
  v_repos jsonb := coalesce(p_repositories, '[]'::jsonb);
begin
  if jsonb_typeof(v_repos) <> 'array' then
    raise exception 'p_repositories must be an array'
      using errcode = '22023';
  end if;

  insert into public.projects (team_id, name, slug, description, is_private)
  values (p_team_id, p_name, p_slug, p_description, coalesce(p_is_private, false))
  returning id into v_project_id;

  insert into public.project_repositories (
    project_id, team_id, github_repo_id, github_full_name, github_html_url,
    github_default_branch, is_private
  )
  select
    v_project_id,
    p_team_id,
    (r ->> 'github_repo_id')::bigint,
    r ->> 'github_full_name',
    coalesce(nullif(r ->> 'github_html_url', ''), 'https://github.com/' || (r ->> 'github_full_name')),
    coalesce(nullif(btrim(r ->> 'github_default_branch'), ''), 'main'),
    coalesce((r ->> 'is_private')::boolean, p_is_private, false)
  from jsonb_array_elements(v_repos) with ordinality as e(r, ord)
  order by e.ord;

  if jsonb_array_length(v_repos) > 0 then
    update public.boards as b
    set is_development = true
    where b.project_id = v_project_id
      and not b.is_development;
  end if;

  return v_project_id;
end;
$$;

revoke all on function public.create_project_with_repositories(uuid, text, text, text, boolean, jsonb) from public, anon;
grant execute on function public.create_project_with_repositories(uuid, text, text, text, boolean, jsonb) to authenticated;
