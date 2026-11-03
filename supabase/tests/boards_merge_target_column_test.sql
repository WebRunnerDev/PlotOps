-- Board merge target: default last_column, same-Board FK, column delete → none.
begin;
create extension if not exists pgtap with schema extensions;

select plan(7);

select set_config('test.owner', 'a1a1a1a1-a1a1-a1a1-a1a1-a1a1a1a1a1a1', true);
select set_config('test.team', 'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2', true);
select set_config('test.project', 'c3c3c3c3-c3c3-c3c3-c3c3-c3c3c3c3c3c3', true);

set local role postgres;

insert into auth.users (
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at
)
values (
  current_setting('test.owner')::uuid,
  'authenticated',
  'authenticated',
  'merge-target-owner@test.com',
  crypt('x', gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  '{}'::jsonb,
  now(),
  now()
)
on conflict (id) do nothing;

insert into public.profiles (id, username)
values (current_setting('test.owner')::uuid, 'merge-target-owner')
on conflict (id) do nothing;

insert into public.teams (id, owner_id, name)
values (
  current_setting('test.team')::uuid,
  current_setting('test.owner')::uuid,
  'Merge Target Fixture Team'
)
on conflict (id) do nothing;

insert into public.projects (id, team_id, name, slug)
values (
  current_setting('test.project')::uuid,
  current_setting('test.team')::uuid,
  'Merge Target Fixture',
  'merge-target-fixture'
)
on conflict (id) do nothing;

select set_config(
  'test.board',
  (
    select b.id::text
    from public.boards as b
    where b.project_id = current_setting('test.project')::uuid
    limit 1
  ),
  true
);

select is(
  (
    select b.merge_target_mode
    from public.boards as b
    where b.id = current_setting('test.board')::uuid
  ),
  'last_column',
  'new Board defaults to last_column'
);

select throws_ok(
  format(
    'update public.boards set merge_target_mode = %L where id = %L',
    'column',
    current_setting('test.board')
  ),
  '23514',
  null,
  'column mode requires a target column'
);

select throws_ok(
  format(
    'update public.boards set merge_target_mode = %L, merge_target_column_id = %L where id = %L',
    'column',
    'no_such_column',
    current_setting('test.board')
  ),
  '23503',
  null,
  'target column must exist on the same Board'
);

select lives_ok(
  format(
    'update public.boards set merge_target_mode = %L, merge_target_column_id = %L where id = %L',
    'column',
    'in_review',
    current_setting('test.board')
  ),
  'Board can target one of its columns'
);

delete from public.board_columns
where board_id = current_setting('test.board')::uuid
  and id = 'in_review';

select is(
  (
    select b.merge_target_mode
    from public.boards as b
    where b.id = current_setting('test.board')::uuid
  ),
  'none',
  'deleting the target column switches the Board to none'
);

select is(
  (
    select b.merge_target_column_id
    from public.boards as b
    where b.id = current_setting('test.board')::uuid
  ),
  null,
  'deleting the target column clears merge_target_column_id'
);

update public.boards
set merge_target_mode = 'column', merge_target_column_id = 'done'
where id = current_setting('test.board')::uuid;

select lives_ok(
  format(
    'delete from public.projects where id = %L',
    current_setting('test.project')
  ),
  'Project DELETE cascades a Board that targets one of its columns'
);

select * from finish();
rollback;
