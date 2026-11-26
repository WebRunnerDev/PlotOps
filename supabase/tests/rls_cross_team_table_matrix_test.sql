-- Table-driven cross-team RLS isolation (#434): for every public table scoped
-- by project_id / task_id / team_id (found in the catalog, not listed by hand),
-- the Owner of Team B can neither read, insert, update nor delete Team A rows.
--
-- A new table is picked up automatically. The first two assertions then fail
-- until the fixture below seeds a Team A row in it (or the table is added to
-- the exempt list with a reason), so the matrix never passes vacuously.
--
-- Storage is covered in rls_cross_team_isolation_test.sql.
begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

select set_config('test.user_a', 'e1111111-1111-1111-1111-111111111111', true);
select set_config('test.user_b', 'e2222222-2222-2222-2222-222222222222', true);
select set_config('test.user_a_member', 'e2222222-2222-2222-2222-222222222223', true);
select set_config('test.team_a', 'e3333333-3333-3333-3333-333333333331', true);
select set_config('test.team_b', 'e3333333-3333-3333-3333-333333333332', true);
select set_config('test.project_a', 'e4444444-4444-4444-4444-444444444441', true);
select set_config('test.project_b', 'e4444444-4444-4444-4444-444444444442', true);
select set_config('test.task_a', 'e5555555-5555-5555-5555-555555555551', true);
select set_config('test.task_a2', 'e5555555-5555-5555-5555-555555555553', true);
select set_config('test.task_b', 'e5555555-5555-5555-5555-555555555552', true);
select set_config('test.repo_a', 'e6666666-6666-6666-6666-666666666661', true);
select set_config('test.sprint_a', 'e7777777-7777-7777-7777-777777777771', true);

set local role postgres;

-- ---------------------------------------------------------------------------
-- Which rows count as "Team A data", per table
-- ---------------------------------------------------------------------------

-- Tables outside the matrix, each with the reason it cannot leak across Teams.
create temp table matrix_exempt (tbl name primary key, reason text not null);
insert into matrix_exempt values
  ('edge_rate_limit_hits', 'service-role only: no client grants, no Team data'),
  ('github_repository_verifications', 'service-role only: no client grants, no Team data (BUG-163)');

-- Tables left out of the INSERT probe only.
create temp table matrix_insert_exempt (tbl name primary key, reason text not null);
insert into matrix_insert_exempt values
  ('teams', 'a new Team row is its inserter''s own Team; a copy of Team A only collides on the id');

-- Scope column per table: project_id, else task_id, else team_id. Tables
-- scoped by another key are mapped explicitly. team_a_key is the value of
-- that column on Team A's rows.
create temp table matrix_scope as
select
  t.table_name::name as tbl,
  coalesce(
    max(c.column_name) filter (where c.column_name = 'project_id'),
    max(c.column_name) filter (where c.column_name = 'task_id'),
    max(c.column_name) filter (where c.column_name = 'team_id')
  )::name as scope_col
from information_schema.tables as t
join information_schema.columns as c using (table_schema, table_name)
where t.table_schema = 'public'
  and t.table_type = 'BASE TABLE'
group by t.table_name;

update matrix_scope set scope_col = 'id' where tbl in ('teams', 'profiles');
update matrix_scope set scope_col = 'user_id' where tbl = 'mcp_action_log';

alter table matrix_scope add column team_a_key uuid;
update matrix_scope set team_a_key = case
  when tbl = 'profiles' or scope_col = 'user_id' then current_setting('test.user_a')::uuid
  when tbl = 'teams' or scope_col = 'team_id' then current_setting('test.team_a')::uuid
  when scope_col = 'project_id' then current_setting('test.project_a')::uuid
  when scope_col = 'task_id' then current_setting('test.task_a')::uuid
end;

delete from matrix_scope where tbl in (select tbl from matrix_exempt);

-- ---------------------------------------------------------------------------
-- Fixture: user A owns Team A (plus one member), user B owns Team B. Team A
-- gets at least one row in every scoped table. Team B has a Project and a Task
-- of its own, so a policy that admits "a member of any Project / Task" (rather
-- than of this row's) shows up as a leak.
-- ---------------------------------------------------------------------------

insert into auth.users (
  id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
values
  (
    current_setting('test.user_a')::uuid, 'authenticated', 'authenticated',
    'rls-matrix-a@test.com', crypt('x', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    current_setting('test.user_b')::uuid, 'authenticated', 'authenticated',
    'rls-matrix-b@test.com', crypt('x', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  ),
  (
    current_setting('test.user_a_member')::uuid, 'authenticated', 'authenticated',
    'rls-matrix-a-member@test.com', crypt('x', gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}'::jsonb, '{}'::jsonb, now(), now()
  )
on conflict (id) do nothing;

insert into public.profiles (id, username)
values
  (current_setting('test.user_a')::uuid, 'rls-matrix-a'),
  (current_setting('test.user_b')::uuid, 'rls-matrix-b'),
  (current_setting('test.user_a_member')::uuid, 'rls-matrix-a-member')
on conflict (id) do nothing;

insert into public.teams (id, owner_id, name)
values
  (current_setting('test.team_a')::uuid, current_setting('test.user_a')::uuid, 'RLS Matrix A'),
  (current_setting('test.team_b')::uuid, current_setting('test.user_b')::uuid, 'RLS Matrix B');

insert into public.projects (id, team_id, name, slug)
values
  (current_setting('test.project_a')::uuid, current_setting('test.team_a')::uuid, 'RLS Matrix A', 'rls-matrix-a'),
  (current_setting('test.project_b')::uuid, current_setting('test.team_b')::uuid, 'RLS Matrix B', 'rls-matrix-b');

-- Owners are implicit; a second member gives team_members a Team A row.
insert into public.team_members (team_id, user_id, role)
values (current_setting('test.team_a')::uuid, current_setting('test.user_a_member')::uuid, 'contributor');

select set_config(
  'test.board_a',
  (select id::text from public.boards where project_id = current_setting('test.project_a')::uuid limit 1),
  true
);

insert into public.tasks (
  id, project_id, board_id, title, status, position, author_id, task_type
)
select
  v.task_id, v.project_id, b.id, 'Matrix task', 'todo', v.pos, v.author_id, 'task'
from (
  values
    (current_setting('test.task_a')::uuid, current_setting('test.project_a')::uuid, current_setting('test.user_a')::uuid, 0),
    (current_setting('test.task_a2')::uuid, current_setting('test.project_a')::uuid, current_setting('test.user_a')::uuid, 1),
    (current_setting('test.task_b')::uuid, current_setting('test.project_b')::uuid, current_setting('test.user_b')::uuid, 0)
) as v (task_id, project_id, author_id, pos)
join lateral (
  select id from public.boards where project_id = v.project_id limit 1
) as b on true;

-- A status move writes task_status_changes.
update public.tasks set status = 'done'
where id = current_setting('test.task_a2')::uuid;

insert into public.activity_log (task_id, project_id, user_id, action)
values (
  current_setting('test.task_a')::uuid,
  current_setting('test.project_a')::uuid,
  current_setting('test.user_a')::uuid,
  'created'
);

insert into public.task_comments (task_id, project_id, author_id, body)
values (
  current_setting('test.task_a')::uuid,
  current_setting('test.project_a')::uuid,
  current_setting('test.user_a')::uuid,
  'secret'
);

insert into public.labels (project_id, name, color)
values (current_setting('test.project_a')::uuid, 'matrix-label', '#ff0000');

insert into public.task_labels (task_id, label_id)
select current_setting('test.task_a')::uuid, id
from public.labels
where project_id = current_setting('test.project_a')::uuid;

insert into public.custom_field_definitions (project_id, name, applies_to)
values (current_setting('test.project_a')::uuid, 'Matrix field', array['task']::public.task_type[]);

insert into public.task_custom_field_values (task_id, field_id, value)
select current_setting('test.task_a')::uuid, id, 'secret'
from public.custom_field_definitions
where project_id = current_setting('test.project_a')::uuid
  and name = 'Matrix field';

insert into public.task_links (project_id, source_task_id, target_task_id, kind)
values (
  current_setting('test.project_a')::uuid,
  current_setting('test.task_a')::uuid,
  current_setting('test.task_a2')::uuid,
  'relates_to'
);

insert into public.notifications (
  recipient_id, project_id, task_id, kind, task_key, task_title
)
values (
  current_setting('test.user_a')::uuid,
  current_setting('test.project_a')::uuid,
  current_setting('test.task_a')::uuid,
  'comment',
  'MTX-1',
  'Matrix task'
);

insert into public.sprints (id, board_id, project_id, name, state)
values (
  current_setting('test.sprint_a')::uuid,
  current_setting('test.board_a')::uuid,
  current_setting('test.project_a')::uuid,
  'Matrix sprint',
  'draft'
);

insert into public.sprint_events (sprint_id, project_id, actor_id, event_type, task_id)
values (
  current_setting('test.sprint_a')::uuid,
  current_setting('test.project_a')::uuid,
  current_setting('test.user_a')::uuid,
  'task_added',
  current_setting('test.task_a')::uuid
);

insert into public.project_repositories (
  id, project_id, team_id, github_repo_id, github_full_name, github_html_url
)
values (
  current_setting('test.repo_a')::uuid,
  current_setting('test.project_a')::uuid,
  current_setting('test.team_a')::uuid,
  434434,
  'matrix/repo-a',
  'https://github.com/matrix/repo-a'
);

insert into public.board_repositories (board_id, repository_id, project_id, base_branch)
values (
  current_setting('test.board_a')::uuid,
  current_setting('test.repo_a')::uuid,
  current_setting('test.project_a')::uuid,
  'main'
);

insert into public.task_git_links (task_id, repository_id, project_id, branch_name)
values (
  current_setting('test.task_a')::uuid,
  current_setting('test.repo_a')::uuid,
  current_setting('test.project_a')::uuid,
  'feat/MTX-1-matrix'
);

insert into public.task_git_link_dismissals (task_id, repository_id, project_id, kind, value)
values (
  current_setting('test.task_a')::uuid,
  current_setting('test.repo_a')::uuid,
  current_setting('test.project_a')::uuid,
  'branch',
  'feat/MTX-1-old'
);

insert into public.team_invites (team_id, email, kind, role, token, status, invited_by)
values (
  current_setting('test.team_a')::uuid,
  null,
  'open',
  'contributor',
  'rls-matrix-token-a',
  'pending',
  current_setting('test.user_a')::uuid
);

insert into public.mcp_action_log (user_id, tool_name)
values (current_setting('test.user_a')::uuid, 'list_tasks');

-- ---------------------------------------------------------------------------
-- Matrix guards: no table slips through unscoped or unseeded
-- ---------------------------------------------------------------------------

select is_empty(
  $$ select tbl from matrix_scope where scope_col is null $$,
  'every public table is scoped by project/task/team (or exempt with a reason)'
);

create function pg_temp.team_a_rows(tbl name, scope_col name, team_a_key uuid)
returns integer
language plpgsql
as $$
declare
  n integer;
begin
  execute format('select count(*) from public.%I where %I = %L', tbl, scope_col, team_a_key)
  into n;
  return n;
end;
$$;

create temp table matrix_before as
select tbl, pg_temp.team_a_rows(tbl, scope_col, team_a_key) as team_a_rows
from matrix_scope
where scope_col is not null;

select is_empty(
  $$ select tbl from matrix_before where team_a_rows = 0 $$,
  'the fixture seeds a Team A row in every scoped table'
);

-- ---------------------------------------------------------------------------
-- Probe: one actor runs SELECT / INSERT / UPDATE / DELETE on every scoped
-- table and records, per (table, op), how many Team A rows it saw, wrote or
-- touched.
--
-- SELECT filters on the Team A scope and counts what comes back.
--
-- INSERT replays a copy of a Team A fixture row: key columns that have a
-- default are left to it, and columns naming a user are set to the actor, so
-- a policy such as "author_id = auth.uid()" can't reject the row for a reason
-- other than Team scope. RLS checks the row before constraints and unique
-- indexes do, so any outcome other than 42501 means RLS admitted it.
--
-- UPDATE and DELETE go in blind, with no WHERE clause: a filter makes Postgres
-- apply the SELECT policies as well, which would hide an UPDATE / DELETE
-- policy opened too wide, while `delete from t` reaches every row its USING
-- clause lets through. Each blind write runs in a rolled-back subtransaction
-- in which the table's own user triggers are off and a BEFORE ROW trigger
-- counts the Team A rows RLS let through, then skips every row. Nothing is
-- written, so the actor's own rows can't trip a guard ("archive before
-- delete", "keep the last board") or a foreign key and hide what the
-- statement reached. This file tests RLS, not those guards.
-- ---------------------------------------------------------------------------

create function pg_temp.as_user(uid uuid)
returns void
language plpgsql
as $$
begin
  perform set_config('request.jwt.claim.sub', uid::text, true);
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', uid::text, 'role', 'authenticated')::text,
    true
  );
  execute 'set local role authenticated';
end;
$$;

-- The statement for one write op, or null when the client holds no grant for
-- it. UPDATE sets a column to DEFAULT, which reads nothing, so only the UPDATE
-- policy applies.
create function pg_temp.write_sql(op text, tbl name, scope_col name, team_a_key uuid, uid uuid)
returns text
language plpgsql
as $$
declare
  set_col name;
  cols text;
  payload jsonb;
begin
  if op = 'insert' then
    execute format(
      'select to_jsonb(x) from public.%I as x where x.%I = %L limit 1',
      tbl, scope_col, team_a_key
    ) into payload;

    select
      string_agg(format('%I', a.attname), ', ' order by a.attnum),
      payload || coalesce(
        jsonb_object_agg(a.attname, uid) filter (
          where a.attname <> scope_col
            and exists (
              select 1 from pg_constraint as k
              where k.conrelid = a.attrelid
                and k.contype = 'f'
                and k.conkey = array[a.attnum]
                and k.confrelid in ('auth.users'::regclass, 'public.profiles'::regclass)
            )
        ),
        '{}'::jsonb
      )
    into cols, payload
    from pg_attribute as a
    where a.attrelid = format('public.%I', tbl)::regclass
      and a.attnum > 0
      and not a.attisdropped
      and a.attgenerated = ''
      and a.attidentity = ''
      and has_column_privilege('authenticated', a.attrelid, a.attnum, 'INSERT')
      and not (
        a.atthasdef
        and a.attname <> scope_col
        and exists (
          select 1 from pg_constraint as k
          where k.conrelid = a.attrelid
            and k.contype in ('p', 'u')
            and a.attnum = any (k.conkey)
        )
      );

    if cols is null then
      return null;
    end if;
    return format(
      'insert into public.%I (%s) select %s from jsonb_populate_record(null::public.%I, %L::jsonb)',
      tbl, cols, cols, tbl, payload
    );
  end if;

  if op = 'delete' then
    if has_table_privilege('authenticated', format('public.%I', tbl), 'DELETE') then
      return format('delete from public.%I', tbl);
    end if;
    return null;
  end if;

  select a.attname into set_col
  from pg_attribute as a
  where a.attrelid = format('public.%I', tbl)::regclass
    and a.attnum > 0
    and not a.attisdropped
    and a.attgenerated = ''
    and a.attidentity = ''
    and has_column_privilege('authenticated', a.attrelid, a.attnum, 'UPDATE')
  order by a.attnum
  limit 1;

  if set_col is null then
    return null;
  end if;
  return format('update public.%I set %I = default', tbl, set_col);
end;
$$;

-- BEFORE ROW trigger for the write probe: counts rows whose scope column
-- (tg_argv[0]) holds Team A's key (tg_argv[1]) and skips every row.
create function pg_temp.count_team_a_row()
returns trigger
language plpgsql
as $$
begin
  if to_jsonb(old) ->> tg_argv[0] = tg_argv[1] then
    perform set_config(
      'test.team_a_touched',
      (current_setting('test.team_a_touched')::integer + 1)::text,
      true
    );
  end if;
  return null;
end;
$$;

create temp table matrix_probe (
  actor text,
  tbl name,
  op text,
  granted boolean,
  team_a_rows integer,
  sqlstate text,
  message text
);

create function pg_temp.probe(actor text, uid uuid, ops text[])
returns void
language plpgsql
as $$
declare
  s record;
  op text;
  stmt text;
  granted boolean;
  team_a_hits integer;
  state text;
  msg text;
begin
  for s in select tbl, scope_col, team_a_key from matrix_scope where scope_col is not null order by tbl loop
    foreach op in array ops loop
      continue when op = 'insert'
        and exists (select 1 from matrix_insert_exempt as e where e.tbl = s.tbl);

      team_a_hits := null;
      state := null;
      msg := null;

      if op = 'select' then
        stmt := format(
          'select count(*) from public.%I where %I = %L',
          s.tbl, s.scope_col, s.team_a_key
        );
        granted := has_table_privilege('authenticated', format('public.%I', s.tbl), 'SELECT');
        if granted then
          begin
            perform pg_temp.as_user(uid);
            execute stmt into team_a_hits;
          exception when others then
            get stacked diagnostics state = returned_sqlstate, msg = message_text;
          end;
        end if;
      else
        stmt := pg_temp.write_sql(op, s.tbl, s.scope_col, s.team_a_key, uid);
        granted := stmt is not null;
        if granted then
          begin
            execute format('alter table public.%I disable trigger user', s.tbl);
            execute format(
              'create trigger zz_count_team_a_row before update or delete on public.%I
                 for each row execute function pg_temp.count_team_a_row(%L, %L)',
              s.tbl, s.scope_col, s.team_a_key
            );
            perform set_config('test.team_a_touched', '0', true);
            perform pg_temp.as_user(uid);
            execute stmt;
            execute 'set local role postgres';
            -- Read before the rollback below resets the setting. An INSERT
            -- that got here wrote its row.
            team_a_hits := case
              when op = 'insert' then 1
              else current_setting('test.team_a_touched')::integer
            end;
            raise exception using errcode = 'P0434', message = 'roll back the probe';
          exception
            when sqlstate 'P0434' then
              null;
            when others then
              get stacked diagnostics state = returned_sqlstate, msg = message_text;
              if op = 'insert' then
                -- 42501 is RLS (or a grant) rejecting the row. Anything else
                -- came after RLS admitted it: a duplicate key, a foreign key.
                team_a_hits := (state <> '42501')::integer;
                if state = '42501' then
                  state := null;
                  msg := null;
                end if;
              end if;
          end;
        end if;
      end if;

      execute 'set local role postgres';
      insert into matrix_probe
      values (actor, s.tbl, op, granted, team_a_hits, state, msg || ' [' || stmt || ']');
    end loop;
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Positive controls: A reaches its own rows, so B's empty results below mean
-- isolation, not a probe that cannot see or touch anything.
-- ---------------------------------------------------------------------------

select pg_temp.probe('A', current_setting('test.user_a')::uuid, array['select', 'insert', 'update', 'delete']);

select is_empty(
  $$
    select tbl || coalesce(': ' || sqlstate || ' ' || message, ': 0 rows')
    from matrix_probe
    where actor = 'A' and op = 'select' and granted
      and coalesce(team_a_rows, 0) = 0
  $$,
  'A sees its own Team A rows in every client-readable scoped table'
);

-- (table, op) pairs where a policy exists but rightly admits none of A's
-- fixture rows (or, for INSERT, A's copy of one).
create temp table matrix_write_control_exempt (tbl name, op text, reason text not null);
insert into matrix_write_control_exempt values
  ('teams', 'delete', 'the Owner may delete only a Team with no Projects');

-- Wherever a policy lets the client INSERT / UPDATE / DELETE at all, the same
-- write as A reaches A's rows.
select is_empty(
  $$
    select p.tbl || ' ' || p.op || coalesce(': ' || p.sqlstate || ' ' || p.message, ': 0 rows')
    from matrix_probe as p
    where p.actor = 'A' and p.op <> 'select' and p.granted
      and exists (
        select 1 from pg_policies as pol
        where pol.schemaname = 'public'
          and pol.tablename = p.tbl
          and pol.cmd in (upper(p.op), 'ALL')
          and pol.roles && array['authenticated', 'public']::name[]
      )
      and not exists (
        select 1 from matrix_write_control_exempt as e
        where e.tbl = p.tbl and e.op = p.op
      )
      and coalesce(p.team_a_rows, 0) = 0
  $$,
  'A''s INSERT / UPDATE / DELETE reaches its own rows wherever a policy allows the op'
);

-- ---------------------------------------------------------------------------
-- B against Team A
-- ---------------------------------------------------------------------------

select pg_temp.probe('B', current_setting('test.user_b')::uuid, array['select', 'insert', 'update', 'delete']);

select is_empty(
  $$
    select tbl || ': ' || coalesce(team_a_rows::text || ' rows', sqlstate || ' ' || message)
    from matrix_probe
    where actor = 'B' and op = 'select' and granted
      and (coalesce(team_a_rows, 0) > 0 or sqlstate is not null)
  $$,
  'B sees no Team A rows in any scoped table'
);

-- UPDATE / DELETE write nothing, so an error there is never a legitimate
-- outcome: it is reported rather than read as "isolated". For INSERT, only
-- 42501 is (recorded as 0 rows).
select is_empty(
  $$
    select tbl || ' ' || op || ': '
      || coalesce(sqlstate || ' ' || message, team_a_rows::text || ' Team A rows written')
    from matrix_probe
    where actor = 'B' and op <> 'select' and granted
      and (coalesce(team_a_rows, 0) > 0 or sqlstate is not null)
  $$,
  'B can insert, update or delete no Team A row in any scoped table'
);

select * from finish();
rollback;
