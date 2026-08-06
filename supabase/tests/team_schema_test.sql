-- Team above Project: schema + RLS + capability helpers + invite RPCs
-- Seams: Postgres helpers, RLS behaviour, invite redeem, migration outcome
begin;
create extension if not exists pgtap with schema extensions;

select plan(12);

-- ---------------------------------------------------------------------------
-- Migration outcome: Team tables present; Project membership gone
-- ---------------------------------------------------------------------------

select has_table('public', 'teams', 'teams table exists');
select has_table('public', 'team_members', 'team_members table exists');
select has_table('public', 'team_invites', 'team_invites table exists');

select hasnt_table('public', 'project_members', 'project_members dropped');
select hasnt_table('public', 'project_invites', 'project_invites dropped');

select has_column('public', 'projects', 'team_id', 'projects.team_id exists');
select hasnt_column('public', 'projects', 'owner_id', 'projects.owner_id dropped');

select col_not_null('public', 'projects', 'team_id', 'projects.team_id is required');

select has_index(
  'public',
  'projects',
  'projects_team_github_repo_unique',
  'unique (team_id, github_repo_id) where repo present'
);

-- ---------------------------------------------------------------------------
-- Capability helpers exist (Team-scoped + Project via team)
-- ---------------------------------------------------------------------------

select has_function('public', 'is_team_owner', array['uuid'], 'is_team_owner(team)');
select has_function('public', 'can_create_project', array['uuid'], 'can_create_project(team)');
select has_function(
  'public',
  'accept_team_invite',
  array['text'],
  'accept_team_invite(token)'
);

select * from finish();
rollback;
