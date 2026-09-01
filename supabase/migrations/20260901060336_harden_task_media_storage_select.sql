-- Security Advisor: public_bucket_allows_listing on task-media.
-- Replace blanket SELECT (enables storage.list for anon) with project-scoped read
-- for authenticated users. Public bucket URLs still work for embedded images.
-- Path layout: {user_id}/{task_id}/{uuid}.ext

drop policy if exists "task_media_select_public" on storage.objects;

create policy "task_media_select_project_members"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'task-media'
  and exists (
    select 1
    from public.tasks as t
    where t.id = ((storage.foldername(name))[2])::uuid
      and public.can_view_project(t.project_id)
  )
);
