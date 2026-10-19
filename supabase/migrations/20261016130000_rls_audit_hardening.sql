-- RLS audit (#280).
-- 1. Client roles keep only DML they reach through RLS. TRUNCATE bypasses RLS
--    entirely; TRIGGER / REFERENCES / MAINTAIN are never needed by the API.
-- 2. task-media writes are scoped to a Task the uploader can edit, so nobody
--    can plant files under another Team's Task folder.
-- 3. task-media SELECT no longer casts arbitrary path segments to uuid (a bad
--    path made every listing of the bucket error out).

-- ---------------------------------------------------------------------------
-- 1. Table privileges
-- ---------------------------------------------------------------------------

revoke truncate, trigger, references on all tables in schema public
  from anon, authenticated;
revoke maintain on all tables in schema public from anon, authenticated;

alter default privileges for role postgres in schema public
  revoke truncate, trigger, references, maintain on tables
  from anon, authenticated;

-- ---------------------------------------------------------------------------
-- 2–3. task-media storage policies
-- Path layout: {user_id}/{task_id}/{uuid}.ext
-- ---------------------------------------------------------------------------

create or replace function public.task_media_path_task_id(object_name text)
returns uuid
language sql
immutable
set search_path = ''
as $$
  select case
    when (storage.foldername(object_name))[2]
      ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    then ((storage.foldername(object_name))[2])::uuid
  end;
$$;

revoke all on function public.task_media_path_task_id(text) from public, anon;
grant execute on function public.task_media_path_task_id(text) to authenticated;

drop policy if exists "task_media_select_project_members" on storage.objects;
create policy "task_media_select_project_members"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'task-media'
  and exists (
    select 1
    from public.tasks as t
    where t.id = public.task_media_path_task_id(name)
      and public.can_view_project(t.project_id)
  )
);

drop policy if exists "task_media_insert_own_folder" on storage.objects;
create policy "task_media_insert_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'task-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1
    from public.tasks as t
    where t.id = public.task_media_path_task_id(name)
      and public.can_edit_tasks(t.project_id)
  )
);

drop policy if exists "task_media_update_own_folder" on storage.objects;
create policy "task_media_update_own_folder"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'task-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
)
with check (
  bucket_id = 'task-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
  and exists (
    select 1
    from public.tasks as t
    where t.id = public.task_media_path_task_id(name)
      and public.can_edit_tasks(t.project_id)
  )
);
