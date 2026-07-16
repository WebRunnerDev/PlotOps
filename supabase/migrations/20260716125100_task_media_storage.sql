-- Task description media (screenshots / images) for PlotOps rich text.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'task-media',
  'task-media',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/gif', 'image/webp']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- Path layout: {user_id}/{task_id}/{uuid}.ext

create policy "task_media_select_public"
on storage.objects
for select
using (bucket_id = 'task-media');

create policy "task_media_insert_own_folder"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'task-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);

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
);

create policy "task_media_delete_own_folder"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'task-media'
  and (storage.foldername(name))[1] = (select auth.uid()::text)
);
