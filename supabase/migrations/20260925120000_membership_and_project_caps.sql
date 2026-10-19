-- Per-user Team caps + per-Team Project cap (ADR 0032).
--
--   * a user may OWN at most 3 Teams              (teams_owned_cap)
--   * a user may JOIN at most 10 Teams            (team_memberships_cap)
--   * a Team may hold at most 10 Projects         (team_projects_cap)
--
-- Enforced by BEFORE-INSERT triggers so every write path is covered: plain
-- RLS inserts *and* the security-definer invite RPCs (accept_team_invite,
-- confirm_team_invite) that bypass RLS. The trigger functions are themselves
-- security definer because the counts span rows the caller cannot see — an
-- Admin adding a Member cannot read that Member's other Teams.
--
-- Errors are raised as P0001 with a `hint` naming the cap; the client matches
-- the hint to pick a message. (Class 53 would be a better fit semantically, but
-- PostgREST maps it to a 503, which reads as an outage.) See
-- src/features/teams/model/limits.ts and src/features/projects/model/limits.ts,
-- which mirror the numbers.

-- ---------------------------------------------------------------------------
-- 1. Cap values (single source of truth; mirrored in the app)
-- ---------------------------------------------------------------------------

create or replace function public.teams_owned_cap()
returns integer
language sql
immutable
set search_path = ''
as $$ select 3 $$;

create or replace function public.team_memberships_cap()
returns integer
language sql
immutable
set search_path = ''
as $$ select 10 $$;

create or replace function public.team_projects_cap()
returns integer
language sql
immutable
set search_path = ''
as $$ select 10 $$;

revoke all on function public.teams_owned_cap() from public;
revoke all on function public.team_memberships_cap() from public;
revoke all on function public.team_projects_cap() from public;

grant execute on function public.teams_owned_cap() to authenticated;
grant execute on function public.team_memberships_cap() to authenticated;
grant execute on function public.team_projects_cap() to authenticated;

-- ---------------------------------------------------------------------------
-- 2. Owned-Team cap — insert, and ownership transfer onto a full user
-- ---------------------------------------------------------------------------

create or replace function public.assert_teams_owned_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cap integer := public.teams_owned_cap();
  v_count integer;
begin
  if tg_op = 'UPDATE' and new.owner_id is not distinct from old.owner_id then
    return new;
  end if;

  select count(*)::integer
  into v_count
  from public.teams as t
  where t.owner_id = new.owner_id
    and (tg_op = 'INSERT' or t.id <> new.id);

  if v_count >= v_cap then
    raise exception 'A user may own at most % Teams', v_cap
      using errcode = 'P0001', hint = 'teams_owned_cap';
  end if;

  return new;
end;
$$;

revoke all on function public.assert_teams_owned_cap() from public;

drop trigger if exists teams_owned_cap on public.teams;
create trigger teams_owned_cap
  before insert or update of owner_id
  on public.teams
  for each row
  execute function public.assert_teams_owned_cap();

-- ---------------------------------------------------------------------------
-- 3. Joined-Team cap
-- ---------------------------------------------------------------------------
-- The Owner being demoted to Admin during transfer_team_ownership is exempt:
-- teams.owner_id still points at them when the row is inserted, so they are
-- already "in" that Team and the net Team count does not grow.

create or replace function public.assert_team_memberships_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cap integer := public.team_memberships_cap();
  v_count integer;
begin
  if exists (
    select 1
    from public.teams as t
    where t.id = new.team_id
      and t.owner_id = new.user_id
  ) then
    return new;
  end if;

  select count(*)::integer
  into v_count
  from public.team_members as m
  where m.user_id = new.user_id;

  if v_count >= v_cap then
    raise exception 'A user may join at most % Teams', v_cap
      using errcode = 'P0001', hint = 'team_memberships_cap';
  end if;

  return new;
end;
$$;

revoke all on function public.assert_team_memberships_cap() from public;

drop trigger if exists team_memberships_cap on public.team_members;
create trigger team_memberships_cap
  before insert
  on public.team_members
  for each row
  execute function public.assert_team_memberships_cap();

-- ---------------------------------------------------------------------------
-- 4. Projects-per-Team cap
-- ---------------------------------------------------------------------------

create or replace function public.assert_team_projects_cap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cap integer := public.team_projects_cap();
  v_count integer;
begin
  select count(*)::integer
  into v_count
  from public.projects as p
  where p.team_id = new.team_id;

  if v_count >= v_cap then
    raise exception 'A Team may hold at most % Projects', v_cap
      using errcode = 'P0001', hint = 'team_projects_cap';
  end if;

  return new;
end;
$$;

revoke all on function public.assert_team_projects_cap() from public;

drop trigger if exists team_projects_cap on public.projects;
create trigger team_projects_cap
  before insert
  on public.projects
  for each row
  execute function public.assert_team_projects_cap();
