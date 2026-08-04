-- Regression: authenticated must have CRUD on sprints (migration grants).
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

select ok(
  has_table_privilege('authenticated', 'public.sprints', 'SELECT'),
  'authenticated can SELECT sprints'
);
select ok(
  has_table_privilege('authenticated', 'public.sprints', 'INSERT'),
  'authenticated can INSERT sprints'
);
select ok(
  has_table_privilege('authenticated', 'public.sprints', 'UPDATE'),
  'authenticated can UPDATE sprints'
);
select ok(
  has_table_privilege('authenticated', 'public.sprints', 'DELETE'),
  'authenticated can DELETE sprints'
);

select ok(
  has_table_privilege('authenticated', 'public.sprint_events', 'SELECT'),
  'authenticated can SELECT sprint_events'
);
select ok(
  has_table_privilege('authenticated', 'public.sprint_events', 'INSERT'),
  'authenticated can INSERT sprint_events'
);
select ok(
  has_table_privilege('authenticated', 'public.sprint_events', 'UPDATE'),
  'authenticated can UPDATE sprint_events'
);
select ok(
  has_table_privilege('authenticated', 'public.sprint_events', 'DELETE'),
  'authenticated can DELETE sprint_events'
);

select * from finish();
rollback;
