-- Project members, invites, and role-aware RLS.
-- Domain: CONTEXT.md + docs/adr/0001–0005

-- ---------------------------------------------------------------------------
-- Enums / tables
-- ---------------------------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'project_member_role'
  ) then
    create type public.project_member_role as enum (
      'admin',
      'manager',
      'contributor',
      'viewer'
    );
  end if;

  if not exists (
    select 1 from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typname = 'project_invite_status'
  ) then
    create type public.project_invite_status as enum (
      'pending',
      'accepted',
      'expired',
      'revoked'
    );
  end if;
end;
$$;

create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.project_member_role not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists project_members_user_id_idx
  on public.project_members (user_id);

create index if not exists project_members_project_role_idx
  on public.project_members (project_id, role);

create table if not exists public.project_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  email text not null,
  role public.project_member_role not null,
  token text not null unique
    default replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''),
  status public.project_invite_status not null default 'pending',
  expires_at timestamptz,
  invited_by uuid not null references public.profiles (id) on delete cascade,
  accepted_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint project_invites_email_nonempty check (length(trim(email)) > 0)
);

create index if not exists project_invites_project_id_idx
  on public.project_invites (project_id);

create index if not exists project_invites_email_idx
  on public.project_invites (lower(email));

create unique index if not exists project_invites_pending_email_unique
  on public.project_invites (project_id, lower(email))
  where status = 'pending';

-- ---------------------------------------------------------------------------
-- Updated-at triggers
-- ---------------------------------------------------------------------------

create or replace function public.set_project_members_updated_at()
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

drop trigger if exists project_members_set_updated_at on public.project_members;
create trigger project_members_set_updated_at
  before update on public.project_members
  for each row
  execute function public.set_project_members_updated_at();

create or replace function public.set_project_invites_updated_at()
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

drop trigger if exists project_invites_set_updated_at on public.project_invites;
create trigger project_invites_set_updated_at
  before update on public.project_invites
  for each row
  execute function public.set_project_invites_updated_at();

-- Prevent non-owners from changing projects.owner_id
create or replace function public.guard_project_owner_id()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if new.owner_id is distinct from old.owner_id
     and old.owner_id is distinct from (select auth.uid()) then
    raise exception 'Only the project owner can transfer ownership';
  end if;
  return new;
end;
$$;

drop trigger if exists projects_guard_owner_id on public.projects;
create trigger projects_guard_owner_id
  before update on public.projects
  for each row
  execute function public.guard_project_owner_id();

-- ---------------------------------------------------------------------------
-- Access helpers (SECURITY DEFINER to avoid RLS recursion on project_members)
-- ---------------------------------------------------------------------------

create or replace function public.is_project_owner(project_uuid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select exists (
    select 1
    from public.projects as p
    where p.id = project_uuid
      and p.owner_id = (select auth.uid())
  );
$$;

create or replace function public.project_member_role_of(project_uuid uuid)
returns public.project_member_role
language sql
security definer
set search_path = ''
stable
as $$
  select m.role
  from public.project_members as m
  where m.project_id = project_uuid
    and m.user_id = (select auth.uid())
  limit 1;
$$;

create or replace function public.is_project_member(project_uuid uuid)
returns boolean
language sql
security definer
set search_path = ''
stable
as $$
  select
    public.is_project_owner(project_uuid)
    or public.project_member_role_of(project_uuid) is not null;
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
  select
    public.is_project_owner(project_uuid)
    or public.project_member_role_of(project_uuid) = any (allowed);
$$;

-- Capability helpers matching the grilled permission matrix

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
  select
    public.is_project_owner(project_uuid)
    or public.project_member_role_of(project_uuid) = 'admin'::public.project_member_role;
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

-- ---------------------------------------------------------------------------
-- Invite RPCs
-- ---------------------------------------------------------------------------

create or replace function public.get_project_invite_by_token(p_token text)
returns table (
  id uuid,
  project_id uuid,
  project_name text,
  email text,
  role public.project_member_role,
  status public.project_invite_status,
  expires_at timestamptz
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
    i.project_id,
    p.name,
    i.email,
    i.role,
    case
      when i.status = 'pending'
        and i.expires_at is not null
        and i.expires_at < now()
      then 'expired'::public.project_invite_status
      else i.status
    end,
    i.expires_at
  from public.project_invites as i
  join public.projects as p on p.id = i.project_id
  where i.token = p_token
  limit 1;
end;
$$;

create or replace function public.accept_project_invite(p_token text)
returns public.project_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.project_invites;
  caller uuid := (select auth.uid());
  caller_email text;
  member public.project_members;
begin
  if caller is null then
    raise exception 'Not authenticated';
  end if;

  select * into invite
  from public.project_invites as i
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
    update public.project_invites
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

  if public.is_project_owner(invite.project_id) then
    raise exception 'Owner is already on this project';
  end if;

  insert into public.project_members (project_id, user_id, role)
  values (invite.project_id, caller, invite.role)
  on conflict (project_id, user_id) do update
    set role = excluded.role
  returning * into member;

  update public.project_invites
  set
    status = 'accepted',
    accepted_by = caller
  where id = invite.id;

  return member;
end;
$$;

create or replace function public.confirm_project_invite(
  p_invite_id uuid,
  p_user_id uuid
)
returns public.project_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  invite public.project_invites;
  member public.project_members;
begin
  if (select auth.uid()) is null then
    raise exception 'Not authenticated';
  end if;

  select * into invite
  from public.project_invites as i
  where i.id = p_invite_id
  for update;

  if invite.id is null then
    raise exception 'Invite not found';
  end if;

  if not public.can_manage_members(invite.project_id) then
    raise exception 'Not allowed to confirm invites';
  end if;

  if invite.role = 'admin'::public.project_member_role
     and not public.is_project_owner(invite.project_id) then
    raise exception 'Only the owner can confirm admin invites';
  end if;

  if invite.status = 'revoked' then
    raise exception 'Invite has been revoked';
  end if;

  if invite.expires_at is not null and invite.expires_at < now() then
    update public.project_invites
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
    from public.projects as p
    where p.id = invite.project_id
      and p.owner_id = p_user_id
  ) then
    raise exception 'Owner is already on this project';
  end if;

  insert into public.project_members (project_id, user_id, role)
  values (invite.project_id, p_user_id, invite.role)
  on conflict (project_id, user_id) do update
    set role = excluded.role
  returning * into member;

  update public.project_invites
  set
    status = 'accepted',
    accepted_by = p_user_id
  where id = invite.id;

  return member;
end;
$$;

revoke all on function public.get_project_invite_by_token(text) from public;
revoke all on function public.accept_project_invite(text) from public;
revoke all on function public.confirm_project_invite(uuid, uuid) from public;

grant execute on function public.get_project_invite_by_token(text) to authenticated;
grant execute on function public.accept_project_invite(text) to authenticated;
grant execute on function public.confirm_project_invite(uuid, uuid) to authenticated;

-- Also allow anon to preview invite by token (accept still requires auth)
grant execute on function public.get_project_invite_by_token(text) to anon;

-- ---------------------------------------------------------------------------
-- RLS: enable + policies
-- ---------------------------------------------------------------------------

alter table public.project_members enable row level security;
alter table public.project_invites enable row level security;

-- Drop old owner-only policies and recreate role-aware ones

drop policy if exists "projects_select_own" on public.projects;
drop policy if exists "projects_insert_own" on public.projects;
drop policy if exists "projects_update_own" on public.projects;
drop policy if exists "projects_delete_own" on public.projects;

create policy "projects_select_member"
  on public.projects
  for select
  to authenticated
  using (public.can_view_project(id));

create policy "projects_insert_own"
  on public.projects
  for insert
  to authenticated
  with check ((select auth.uid()) = owner_id);

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

-- tasks
drop policy if exists "tasks_select_own_projects" on public.tasks;
drop policy if exists "tasks_insert_own_projects" on public.tasks;
drop policy if exists "tasks_update_own_projects" on public.tasks;
drop policy if exists "tasks_delete_own_projects" on public.tasks;

create policy "tasks_select_member"
  on public.tasks
  for select
  to authenticated
  using (public.can_view_project(project_id));

create policy "tasks_insert_managers"
  on public.tasks
  for insert
  to authenticated
  with check (public.can_create_tasks(project_id));

create policy "tasks_update_editors"
  on public.tasks
  for update
  to authenticated
  using (public.can_edit_tasks(project_id))
  with check (public.can_edit_tasks(project_id));

create policy "tasks_delete_managers"
  on public.tasks
  for delete
  to authenticated
  using (public.can_delete_tasks(project_id));

-- board_columns
drop policy if exists "board_columns_select_own_projects" on public.board_columns;
drop policy if exists "board_columns_insert_own_projects" on public.board_columns;
drop policy if exists "board_columns_update_own_projects" on public.board_columns;
drop policy if exists "board_columns_delete_own_projects" on public.board_columns;

create policy "board_columns_select_member"
  on public.board_columns
  for select
  to authenticated
  using (public.can_view_project(project_id));

create policy "board_columns_insert_managers"
  on public.board_columns
  for insert
  to authenticated
  with check (public.can_manage_board(project_id));

create policy "board_columns_update_managers"
  on public.board_columns
  for update
  to authenticated
  using (public.can_manage_board(project_id))
  with check (public.can_manage_board(project_id));

create policy "board_columns_delete_managers"
  on public.board_columns
  for delete
  to authenticated
  using (public.can_manage_board(project_id));

-- labels
drop policy if exists "labels_select_own_projects" on public.labels;
drop policy if exists "labels_insert_own_projects" on public.labels;
drop policy if exists "labels_update_own_projects" on public.labels;
drop policy if exists "labels_delete_own_projects" on public.labels;

create policy "labels_select_member"
  on public.labels
  for select
  to authenticated
  using (public.can_view_project(project_id));

create policy "labels_insert_managers"
  on public.labels
  for insert
  to authenticated
  with check (public.can_manage_board(project_id));

create policy "labels_update_managers"
  on public.labels
  for update
  to authenticated
  using (public.can_manage_board(project_id))
  with check (public.can_manage_board(project_id));

create policy "labels_delete_managers"
  on public.labels
  for delete
  to authenticated
  using (public.can_manage_board(project_id));

-- task_labels (Contributor may attach/detach labels while editing tasks)
drop policy if exists "task_labels_select_own_projects" on public.task_labels;
drop policy if exists "task_labels_insert_own_projects" on public.task_labels;
drop policy if exists "task_labels_delete_own_projects" on public.task_labels;

create policy "task_labels_select_member"
  on public.task_labels
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.tasks as t
      where t.id = task_labels.task_id
        and public.can_view_project(t.project_id)
    )
  );

create policy "task_labels_insert_editors"
  on public.task_labels
  for insert
  to authenticated
  with check (
    exists (
      select 1
      from public.tasks as t
      where t.id = task_labels.task_id
        and public.can_edit_tasks(t.project_id)
    )
    and exists (
      select 1
      from public.labels as l
      where l.id = task_labels.label_id
        and public.can_view_project(l.project_id)
    )
  );

create policy "task_labels_delete_editors"
  on public.task_labels
  for delete
  to authenticated
  using (
    exists (
      select 1
      from public.tasks as t
      where t.id = task_labels.task_id
        and public.can_edit_tasks(t.project_id)
    )
  );

-- project_task_sequences (Manager/Admin create tasks → trigger writes here)
drop policy if exists "pts_owner" on public.project_task_sequences;

create policy "pts_task_creators"
  on public.project_task_sequences
  for all
  to authenticated
  using (public.can_create_tasks(project_id))
  with check (public.can_create_tasks(project_id));

-- project_members
create policy "project_members_select"
  on public.project_members
  for select
  to authenticated
  using (public.can_view_project(project_id));

create policy "project_members_insert"
  on public.project_members
  for insert
  to authenticated
  with check (
    public.is_project_owner(project_id)
    or (
      public.can_manage_members(project_id)
      and role <> 'admin'::public.project_member_role
    )
  );

create policy "project_members_update"
  on public.project_members
  for update
  to authenticated
  using (
    public.is_project_owner(project_id)
    or (
      public.can_manage_members(project_id)
      and role <> 'admin'::public.project_member_role
    )
  )
  with check (
    public.is_project_owner(project_id)
    or (
      public.can_manage_members(project_id)
      and role <> 'admin'::public.project_member_role
    )
  );

create policy "project_members_delete"
  on public.project_members
  for delete
  to authenticated
  using (
    -- self-leave
    user_id = (select auth.uid())
    or public.is_project_owner(project_id)
    or (
      public.can_manage_members(project_id)
      and role <> 'admin'::public.project_member_role
    )
  );

-- project_invites
create policy "project_invites_select"
  on public.project_invites
  for select
  to authenticated
  using (public.can_manage_members(project_id));

create policy "project_invites_insert"
  on public.project_invites
  for insert
  to authenticated
  with check (
    invited_by = (select auth.uid())
    and (
      public.is_project_owner(project_id)
      or (
        public.can_manage_members(project_id)
        and role <> 'admin'::public.project_member_role
      )
    )
  );

create policy "project_invites_update"
  on public.project_invites
  for update
  to authenticated
  using (public.can_manage_members(project_id))
  with check (
    public.is_project_owner(project_id)
    or (
      public.can_manage_members(project_id)
      and role <> 'admin'::public.project_member_role
    )
  );

create policy "project_invites_delete"
  on public.project_invites
  for delete
  to authenticated
  using (public.can_manage_members(project_id));

-- profiles: see people who share a project (assignees / members UI)
drop policy if exists "profiles_select_own" on public.profiles;

create policy "profiles_select_own_or_shared"
  on public.profiles
  for select
  to authenticated
  using (
    id = (select auth.uid())
    or exists (
      select 1
      from public.projects as p
      where p.owner_id = profiles.id
        and public.can_view_project(p.id)
    )
    or exists (
      select 1
      from public.project_members as m
      where m.user_id = profiles.id
        and public.can_view_project(m.project_id)
    )
  );

grant select, insert, update, delete on public.project_members to authenticated;
grant select, insert, update, delete on public.project_invites to authenticated;

notify pgrst, 'reload schema';
