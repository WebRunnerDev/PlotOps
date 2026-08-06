-- Team above Project (ADR 0017 / #155)
-- teams / team_members / team_invites, projects.team_id, 1:1 backfill,
-- capability helpers + RLS on Team, drop project membership + projects.owner_id,
-- unique (team_id, github_repo_id).

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------

create table if not exists public.teams (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint teams_name_nonempty check (length(trim(name)) > 0)
);

create index if not exists teams_owner_id_idx on public.teams (owner_id);

create table if not exists public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.project_member_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create index if not exists team_members_user_id_idx
  on public.team_members (user_id);

create index if not exists team_members_team_role_idx
  on public.team_members (team_id, role);

create table if not exists public.team_invites (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references public.teams (id) on delete cascade,
  email text not null,
  role public.project_member_role not null,
  token text not null unique
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  status public.project_invite_status not null default 'pending',
  expires_at timestamptz,
  invited_by uuid not null references public.profiles (id) on delete cascade,
  accepted_by uuid references public.profiles (id) on delete set null,
  claimed_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint team_invites_email_nonempty check (length(trim(email)) > 0)
);

create index if not exists team_invites_team_id_idx
  on public.team_invites (team_id);

create index if not exists team_invites_email_idx
  on public.team_invites (lower(email));

create unique index if not exists team_invites_pending_email_unique
  on public.team_invites (team_id, lower(email))
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- 2. Updated-at + owner-transfer guards
-- ---------------------------------------------------------------------------

create or replace function public.set_teams_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists teams_set_updated_at on public.teams;
create trigger teams_set_updated_at
  before update on public.teams
  for each row
  execute function public.set_teams_updated_at();

create or replace function public.set_team_members_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists team_members_set_updated_at on public.team_members;
create trigger team_members_set_updated_at
  before update on public.team_members
  for each row
  execute function public.set_team_members_updated_at();

create or replace function public.set_team_invites_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists team_invites_set_updated_at on public.team_invites;
create trigger team_invites_set_updated_at
  before update on public.team_invites
  for each row
  execute function public.set_team_invites_updated_at();

create or replace function public.guard_team_owner_id()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id
     and old.owner_id is distinct from (select auth.uid()) then
    raise exception 'Only the team owner can transfer ownership';
  end if;
  return new;
end;
$$;

drop trigger if exists teams_guard_owner_id on public.teams;
create trigger teams_guard_owner_id
  before update on public.teams
  for each row
  execute function public.guard_team_owner_id();

-- ---------------------------------------------------------------------------
-- 3. projects.team_id + 1:1 backfill
-- ---------------------------------------------------------------------------

alter table public.projects
  add column if not exists team_id uuid references public.teams (id);

do $$
declare
  r record;
  new_team_id uuid;
begin
  for r in
    select id, owner_id, name, created_at, updated_at
    from public.projects
    where team_id is null
  loop
    insert into public.teams (owner_id, name, created_at, updated_at)
    values (r.owner_id, r.name, r.created_at, r.updated_at)
    returning id into new_team_id;

    update public.projects
    set team_id = new_team_id
    where id = r.id;
  end loop;
end;
$$;

insert into public.team_members (team_id, user_id, role, created_at, updated_at)
select p.team_id, pm.user_id, pm.role, pm.created_at, pm.updated_at
from public.project_members as pm
join public.projects as p on p.id = pm.project_id
where p.team_id is not null
on conflict (team_id, user_id) do nothing;

insert into public.team_invites (
  id,
  team_id,
  email,
  role,
  token,
  status,
  expires_at,
  invited_by,
  accepted_by,
  claimed_by,
  created_at,
  updated_at
)
select
  pi.id,
  p.team_id,
  pi.email,
  pi.role,
  pi.token,
  pi.status,
  pi.expires_at,
  pi.invited_by,
  pi.accepted_by,
  pi.claimed_by,
  pi.created_at,
  pi.updated_at
from public.project_invites as pi
join public.projects as p on p.id = pi.project_id
where p.team_id is not null
on conflict (id) do nothing;

do $$
begin
  if exists (select 1 from public.projects where team_id is null) then
    raise exception 'Team backfill left projects without team_id';
  end if;

  if (
    select count(*)::bigint from public.project_members
  ) <> (
    select count(*)::bigint from public.team_members
  ) then
    raise exception 'Team member backfill count mismatch';
  end if;

  if (
    select count(*)::bigint from public.project_invites
  ) <> (
    select count(*)::bigint from public.team_invites
  ) then
    raise exception 'Team invite backfill count mismatch';
  end if;
end;
$$;

alter table public.projects
  alter column team_id set not null;

create index if not exists projects_team_id_idx on public.projects (team_id);

-- ---------------------------------------------------------------------------
-- 4. Team + Project capability helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_team_owner(team_uuid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.teams as t
    where t.id = team_uuid
      and t.owner_id = (select auth.uid())
  );
$$;

create or replace function public.team_member_role_of(team_uuid uuid)
returns public.project_member_role
language sql
security definer
set search_path = ''
stable
as $$
  select m.role
  from public.team_members as m
  where m.team_id = team_uuid
    and m.user_id = (select auth.uid())
  limit 1;
$$;

create or replace function public.is_team_member(team_uuid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select
    public.is_team_owner(team_uuid)
    or public.team_member_role_of(team_uuid) is not null;
$$;

create or replace function public.has_team_role(
  team_uuid uuid,
  allowed public.project_member_role[]
)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select
    public.is_team_owner(team_uuid)
    or public.team_member_role_of(team_uuid) = any (allowed);
$$;

create or replace function public.can_manage_team_members(team_uuid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select
    public.is_team_owner(team_uuid)
    or public.team_member_role_of(team_uuid) = 'admin'::public.project_member_role;
$$;

create or replace function public.can_create_project(team_uuid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select public.can_manage_team_members(team_uuid);
$$;

create or replace function public.can_delete_team(team_uuid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select
    public.is_team_owner(team_uuid)
    and not exists (
      select 1 from public.projects as p where p.team_id = team_uuid
    );
$$;

create or replace function public.project_team_id(project_uuid uuid)
returns uuid
language sql
security definer
set search_path = ''
stable
as $$
  select p.team_id
  from public.projects as p
  where p.id = project_uuid;
$$;

create or replace function public.is_project_owner(project_uuid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select public.is_team_owner(public.project_team_id(project_uuid));
$$;

create or replace function public.project_member_role_of(project_uuid uuid)
returns public.project_member_role
language sql
security definer
set search_path = ''
stable
as $$
  select public.team_member_role_of(public.project_team_id(project_uuid));
$$;

create or replace function public.is_project_member(project_uuid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select public.is_team_member(public.project_team_id(project_uuid));
$$;

create or replace function public.has_project_role(
  project_uuid uuid,
  allowed public.project_member_role[]
)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select public.has_team_role(public.project_team_id(project_uuid), allowed);
$$;

create or replace function public.can_view_project(project_uuid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select public.is_project_member(project_uuid);
$$;

create or replace function public.can_edit_tasks(project_uuid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select public.has_project_role(
    project_uuid,
    array[
      'admin'::public.project_member_role,
      'manager'::public.project_member_role,
      'contributor'::public.project_member_role
    ]
  );
$$;

create or replace function public.can_create_tasks(project_uuid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select public.has_project_role(
    project_uuid,
    array[
      'admin'::public.project_member_role,
      'manager'::public.project_member_role
    ]
  );
$$;

create or replace function public.can_delete_tasks(project_uuid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select public.can_create_tasks(project_uuid);
$$;

create or replace function public.can_manage_board(project_uuid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select public.can_create_tasks(project_uuid);
$$;

create or replace function public.can_manage_members(project_uuid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select public.can_manage_team_members(public.project_team_id(project_uuid));
$$;

create or replace function public.can_manage_project_settings(project_uuid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select public.can_manage_members(project_uuid);
$$;

create or replace function public.is_project_participant(
  p_project_id uuid,
  p_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path to ''
as $$
  select
    p_user_id is not null
    and (
      exists (
        select 1
        from public.projects as p
        join public.teams as t on t.id = p.team_id
        where p.id = p_project_id
          and t.owner_id = p_user_id
      )
      or exists (
        select 1
        from public.projects as p
        join public.team_members as m on m.team_id = p.team_id
        where p.id = p_project_id
          and m.user_id = p_user_id
      )
    );
$$;

revoke all on function public.is_team_owner(uuid) from public;
revoke all on function public.team_member_role_of(uuid) from public;
revoke all on function public.is_team_member(uuid) from public;
revoke all on function public.has_team_role(uuid, public.project_member_role[]) from public;
revoke all on function public.can_manage_team_members(uuid) from public;
revoke all on function public.can_create_project(uuid) from public;
revoke all on function public.can_delete_team(uuid) from public;
revoke all on function public.project_team_id(uuid) from public;
revoke all on function public.is_project_owner(uuid) from public;
revoke all on function public.project_member_role_of(uuid) from public;
revoke all on function public.is_project_member(uuid) from public;
revoke all on function public.has_project_role(uuid, public.project_member_role[]) from public;
revoke all on function public.can_view_project(uuid) from public;
revoke all on function public.can_edit_tasks(uuid) from public;
revoke all on function public.can_create_tasks(uuid) from public;
revoke all on function public.can_delete_tasks(uuid) from public;
revoke all on function public.can_manage_board(uuid) from public;
revoke all on function public.can_manage_members(uuid) from public;
revoke all on function public.can_manage_project_settings(uuid) from public;
revoke all on function public.is_project_participant(uuid, uuid) from public;
revoke all on function public.is_project_participant(uuid, uuid) from anon;
revoke all on function public.is_project_participant(uuid, uuid) from authenticated;

grant execute on function public.is_team_owner(uuid) to authenticated;
grant execute on function public.team_member_role_of(uuid) to authenticated;
grant execute on function public.is_team_member(uuid) to authenticated;
grant execute on function public.has_team_role(uuid, public.project_member_role[]) to authenticated;
grant execute on function public.can_manage_team_members(uuid) to authenticated;
grant execute on function public.can_create_project(uuid) to authenticated;
grant execute on function public.can_delete_team(uuid) to authenticated;
grant execute on function public.project_team_id(uuid) to authenticated;
grant execute on function public.is_project_owner(uuid) to authenticated;
grant execute on function public.project_member_role_of(uuid) to authenticated;
grant execute on function public.is_project_member(uuid) to authenticated;
grant execute on function public.has_project_role(uuid, public.project_member_role[]) to authenticated;
grant execute on function public.can_view_project(uuid) to authenticated;
grant execute on function public.can_edit_tasks(uuid) to authenticated;
grant execute on function public.can_create_tasks(uuid) to authenticated;
grant execute on function public.can_delete_tasks(uuid) to authenticated;
grant execute on function public.can_manage_board(uuid) to authenticated;
grant execute on function public.can_manage_members(uuid) to authenticated;
grant execute on function public.can_manage_project_settings(uuid) to authenticated;
grant execute on function public.is_project_participant(uuid, uuid) to service_role;

-- ---------------------------------------------------------------------------
-- 5. Invite RPCs (Team-scoped)
-- ---------------------------------------------------------------------------

drop function if exists public.get_project_invite_by_token(text);
drop function if exists public.accept_project_invite(text);
drop function if exists public.claim_project_invite(text);
drop function if exists public.confirm_project_invite(uuid, uuid);

create or replace function public.get_team_invite_by_token(p_token text)
returns table (
  id uuid,
  team_id uuid,
  team_name text,
  email text,
  role public.project_member_role,
  status public.project_invite_status,
  expires_at timestamptz,
  claimed_by uuid
)
language plpgsql
security definer
set search_path = ''
stable
as $$
begin
  if p_token is null or length(trim(p_token)) = 0 then
    return;
  end if;

  return query
  select
    i.id,
    i.team_id,
    t.name,
    i.email,
    i.role,
    case
      when i.status = 'pending'
        and i.expires_at is not null
        and i.expires_at < now()
      then 'expired'::public.project_invite_status
      else i.status
    end,
    i.expires_at,
    i.claimed_by
  from public.team_invites as i
  join public.teams as t on t.id = i.team_id
  where i.token = p_token
  limit 1;
end;
$$;

create or replace function public.accept_team_invite(p_token text)
returns public.team_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.team_invites;
  caller uuid := (select auth.uid());
  caller_email text;
  member public.team_members;
begin
  if caller is null then
    raise exception 'Not authenticated';
  end if;

  select * into invite
  from public.team_invites as i
  where i.token = p_token
  for update;

  if invite.id is null then
    raise exception 'Invite not found';
  end if;

  if invite.status = 'revoked' then
    raise exception 'Invite has been revoked';
  end if;

  if invite.status = 'accepted' then
    raise exception 'Invite already accepted';
  end if;

  if invite.expires_at is not null and invite.expires_at < now() then
    update public.team_invites
    set status = 'expired'
    where id = invite.id;
    raise exception 'Invite has expired';
  end if;

  if invite.status <> 'pending' then
    raise exception 'Invite is not pending';
  end if;

  select u.email into caller_email
  from auth.users as u
  where u.id = caller;

  if caller_email is null
     or lower(caller_email) <> lower(invite.email) then
    raise exception 'Email does not match invite. Ask an owner or admin to confirm.';
  end if;

  if public.is_team_owner(invite.team_id) then
    raise exception 'Owner is already on this team';
  end if;

  insert into public.team_members (team_id, user_id, role)
  values (invite.team_id, caller, invite.role)
  on conflict (team_id, user_id) do update
    set role = excluded.role
  returning * into member;

  update public.team_invites
  set
    status = 'accepted',
    accepted_by = caller
  where id = invite.id;

  return member;
end;
$$;

create or replace function public.claim_team_invite(p_token text)
returns public.team_invites
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.team_invites;
  caller uuid := (select auth.uid());
  caller_email text;
begin
  if caller is null then
    raise exception 'Not authenticated';
  end if;

  select * into invite
  from public.team_invites as i
  where i.token = p_token
  for update;

  if invite.id is null then
    raise exception 'Invite not found';
  end if;

  if invite.status <> 'pending' then
    raise exception 'Invite is not pending';
  end if;

  if invite.expires_at is not null and invite.expires_at < now() then
    update public.team_invites
    set status = 'expired'
    where id = invite.id;
    raise exception 'Invite has expired';
  end if;

  select u.email into caller_email
  from auth.users as u
  where u.id = caller;

  if caller_email is not null
     and lower(caller_email) = lower(invite.email) then
    raise exception 'Email matches — accept the invite instead';
  end if;

  if exists (
    select 1
    from public.teams as t
    where t.id = invite.team_id
      and t.owner_id = caller
  ) then
    raise exception 'Owner is already on this team';
  end if;

  if exists (
    select 1
    from public.team_members as m
    where m.team_id = invite.team_id
      and m.user_id = caller
  ) then
    raise exception 'Already a member of this team';
  end if;

  update public.team_invites
  set claimed_by = caller
  where id = invite.id
  returning * into invite;

  return invite;
end;
$$;

create or replace function public.confirm_team_invite(
  p_invite_id uuid,
  p_user_id uuid
)
returns public.team_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.team_invites;
  member public.team_members;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;

  select * into invite
  from public.team_invites as i
  where i.id = p_invite_id
  for update;

  if invite.id is null then
    raise exception 'Invite not found';
  end if;

  if not public.can_manage_team_members(invite.team_id) then
    raise exception 'Not allowed to confirm invites';
  end if;

  if invite.role = 'admin'::public.project_member_role
     and not public.is_team_owner(invite.team_id) then
    raise exception 'Only the owner can confirm admin invites';
  end if;

  if invite.status = 'revoked' then
    raise exception 'Invite has been revoked';
  end if;

  if invite.expires_at is not null and invite.expires_at < now() then
    update public.team_invites
    set status = 'expired'
    where id = invite.id;
    raise exception 'Invite has expired';
  end if;

  if invite.status not in ('pending', 'accepted') then
    raise exception 'Invite cannot be confirmed';
  end if;

  if p_user_id is null then
    raise exception 'User is required';
  end if;

  if not exists (
    select 1 from public.profiles as pr where pr.id = p_user_id
  ) then
    raise exception 'User profile not found';
  end if;

  if exists (
    select 1
    from public.teams as t
    where t.id = invite.team_id
      and t.owner_id = p_user_id
  ) then
    raise exception 'Owner is already on this team';
  end if;

  insert into public.team_members (team_id, user_id, role)
  values (invite.team_id, p_user_id, invite.role)
  on conflict (team_id, user_id) do update
    set role = excluded.role
  returning * into member;

  update public.team_invites
  set
    status = 'accepted',
    accepted_by = p_user_id
  where id = invite.id;

  return member;
end;
$$;

revoke all on function public.get_team_invite_by_token(text) from public;
revoke all on function public.accept_team_invite(text) from public;
revoke all on function public.claim_team_invite(text) from public;
revoke all on function public.confirm_team_invite(uuid, uuid) from public;

grant execute on function public.get_team_invite_by_token(text) to authenticated;
grant execute on function public.get_team_invite_by_token(text) to anon;
grant execute on function public.accept_team_invite(text) to authenticated;
grant execute on function public.claim_team_invite(text) to authenticated;
grant execute on function public.confirm_team_invite(uuid, uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Watchers cleanup on Team leave/remove
-- ---------------------------------------------------------------------------

drop trigger if exists task_watchers_cleanup_on_project_members_delete
  on public.project_members;
drop function if exists public.task_watchers_cleanup_on_project_members_delete();

create or replace function public.task_watchers_cleanup_on_team_members_delete()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from public.task_watchers as tw
  using public.projects as p
  where p.team_id = old.team_id
    and tw.project_id = p.id
    and tw.user_id = old.user_id;
  return old;
end;
$$;

drop trigger if exists task_watchers_cleanup_on_team_members_delete
  on public.team_members;
create trigger task_watchers_cleanup_on_team_members_delete
  after delete on public.team_members
  for each row
  execute function public.task_watchers_cleanup_on_team_members_delete();

-- ---------------------------------------------------------------------------
-- 7. Mention fan-out: Team-backed participant check (same signature)
-- ---------------------------------------------------------------------------

create or replace function public.create_notifications_for_mentions(
  p_task_id uuid,
  p_mentionee_ids uuid[],
  p_source text,
  p_comment_id uuid default null,
  p_actor_name text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := auth.uid();
  v_project_id uuid;
  v_task_key text;
  v_task_title text;
  v_actor_name text;
  v_metadata jsonb;
  v_comment_id uuid;
begin
  if actor is null then
    return;
  end if;

  if p_mentionee_ids is null or cardinality(p_mentionee_ids) = 0 then
    return;
  end if;

  if p_source is null or p_source not in ('description', 'comment') then
    return;
  end if;

  select t.project_id, t.task_key, t.title
    into v_project_id, v_task_key, v_task_title
  from public.tasks as t
  where t.id = p_task_id
  limit 1;

  if v_project_id is null or v_task_key is null or v_task_title is null then
    return;
  end if;

  if public.can_edit_tasks(v_project_id) = false then
    return;
  end if;

  v_comment_id := case
    when p_source = 'comment' then p_comment_id
    else null
  end;

  select coalesce(
    nullif(
      trim(
        concat_ws(
          ' ',
          nullif(trim(p.first_name), ''),
          nullif(trim(p.last_name), '')
        )
      ),
      ''
    ),
    nullif(trim(p.username), ''),
    actor::text
  )
    into v_actor_name
  from public.profiles as p
  where p.id = actor
  limit 1;

  if v_actor_name is null then
    v_actor_name := coalesce(nullif(trim(p_actor_name), ''), actor::text);
  end if;

  v_metadata := jsonb_build_object(
    'source', p_source,
    'actor', jsonb_build_object(
      'id', actor,
      'name', v_actor_name
    )
  );

  if v_comment_id is not null then
    v_metadata := v_metadata || jsonb_build_object('commentId', v_comment_id);
  end if;

  insert into public.notifications (
    recipient_id,
    project_id,
    task_id,
    kind,
    task_key,
    task_title,
    metadata
  )
  select
    mentionee_id,
    v_project_id,
    p_task_id,
    'mention',
    v_task_key,
    v_task_title,
    v_metadata
  from (
    select distinct unnest(p_mentionee_ids) as mentionee_id
  ) as mentionees
  where mentionee_id is not null
    and mentionee_id <> actor
    and public.is_project_participant(v_project_id, mentionee_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- 8. RLS: teams / team_members / team_invites + rewrite projects policies
-- ---------------------------------------------------------------------------

alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_invites enable row level security;

drop policy if exists "projects_select_member" on public.projects;
drop policy if exists "projects_insert_own" on public.projects;
drop policy if exists "projects_update_managers" on public.projects;
drop policy if exists "projects_delete_own" on public.projects;

create policy "projects_select_member"
  on public.projects
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.teams as t
      where t.id = projects.team_id
        and t.owner_id = (select auth.uid())
    )
    or public.can_view_project(id)
  );

create policy "projects_insert_team_managers"
  on public.projects
  for insert
  to authenticated
  with check (public.can_create_project(team_id));

create policy "projects_update_managers"
  on public.projects
  for update
  to authenticated
  using (public.can_manage_project_settings(id))
  with check (public.can_manage_project_settings(id));

create policy "projects_delete_own"
  on public.projects
  for delete
  to authenticated
  using (public.is_project_owner(id));

create policy "teams_select_member"
  on public.teams
  for select
  to authenticated
  using (public.is_team_member(id));

create policy "teams_insert_owner"
  on public.teams
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

create policy "teams_update_managers"
  on public.teams
  for update
  to authenticated
  using (public.can_manage_team_members(id))
  with check (public.can_manage_team_members(id));

create policy "teams_delete_owner_empty"
  on public.teams
  for delete
  to authenticated
  using (public.can_delete_team(id));

create policy "team_members_select"
  on public.team_members
  for select
  to authenticated
  using (public.is_team_member(team_id));

create policy "team_members_insert"
  on public.team_members
  for insert
  to authenticated
  with check (
    public.is_team_owner(team_id)
    or (
      public.can_manage_team_members(team_id)
      and role <> 'admin'::public.project_member_role
    )
  );

create policy "team_members_update"
  on public.team_members
  for update
  to authenticated
  using (
    public.is_team_owner(team_id)
    or (
      public.can_manage_team_members(team_id)
      and role <> 'admin'::public.project_member_role
    )
  )
  with check (
    public.is_team_owner(team_id)
    or (
      public.can_manage_team_members(team_id)
      and role <> 'admin'::public.project_member_role
    )
  );

create policy "team_members_delete"
  on public.team_members
  for delete
  to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_team_owner(team_id)
    or (
      public.can_manage_team_members(team_id)
      and role <> 'admin'::public.project_member_role
    )
  );

create policy "team_invites_select"
  on public.team_invites
  for select
  to authenticated
  using (public.can_manage_team_members(team_id));

create policy "team_invites_insert"
  on public.team_invites
  for insert
  to authenticated
  with check (
    invited_by = (select auth.uid())
    and (
      public.is_team_owner(team_id)
      or (
        public.can_manage_team_members(team_id)
        and role <> 'admin'::public.project_member_role
      )
    )
  );

create policy "team_invites_update"
  on public.team_invites
  for update
  to authenticated
  using (public.can_manage_team_members(team_id))
  with check (
    public.is_team_owner(team_id)
    or (
      public.can_manage_team_members(team_id)
      and role <> 'admin'::public.project_member_role
    )
  );

create policy "team_invites_delete"
  on public.team_invites
  for delete
  to authenticated
  using (public.can_manage_team_members(team_id));

drop policy if exists "profiles_select_own_or_shared" on public.profiles;

create policy "profiles_select_own_or_shared"
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.teams as t
      where t.owner_id = profiles.id
        and public.is_team_member(t.id)
    )
    or exists (
      select 1
      from public.team_members as m
      where m.user_id = profiles.id
        and public.is_team_member(m.team_id)
    )
  );

grant select, insert, update, delete on public.teams to authenticated;
grant select, insert, update, delete on public.team_members to authenticated;
grant select, insert, update, delete on public.team_invites to authenticated;

-- ---------------------------------------------------------------------------
-- 9. Drop Project membership overlay + owner_id; new uniqueness
-- ---------------------------------------------------------------------------

drop trigger if exists projects_guard_owner_id on public.projects;
drop function if exists public.guard_project_owner_id();

drop trigger if exists project_members_set_updated_at on public.project_members;
drop trigger if exists project_invites_set_updated_at on public.project_invites;

drop table if exists public.project_invites;
drop table if exists public.project_members;

drop function if exists public.set_project_members_updated_at();
drop function if exists public.set_project_invites_updated_at();

drop index if exists public.projects_owner_github_repo_unique;
drop index if exists public.projects_owner_slug_unique;
drop index if exists public.projects_owner_id_idx;

alter table public.projects drop column if exists owner_id;

create unique index if not exists projects_team_github_repo_unique
  on public.projects (team_id, github_repo_id)
  where github_repo_id is not null;

create unique index if not exists projects_team_slug_unique
  on public.projects (team_id, slug);

notify pgrst, 'reload schema';
