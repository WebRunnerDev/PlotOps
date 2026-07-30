-- Add First name / Last name on profiles; keep username as handle.
-- Copy names from auth metadata on signup; prefer them for mention actor display.

alter table public.profiles
  add column if not exists first_name text;

alter table public.profiles
  add column if not exists last_name text;

create or replace function public.handle_new_user_profile()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, username, avatar_url, first_name, last_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'user_name',
      new.raw_user_meta_data ->> 'preferred_username',
      new.raw_user_meta_data ->> 'name',
      split_part(new.email, '@', 1)
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    ),
    nullif(trim(new.raw_user_meta_data ->> 'first_name'), ''),
    nullif(trim(new.raw_user_meta_data ->> 'last_name'), '')
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

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
    v_actor_name := actor::text;
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
    and (
      exists (
        select 1
        from public.projects as p
        where p.id = v_project_id
          and p.owner_id = mentionee_id
      )
      or exists (
        select 1
        from public.project_members as m
        where m.project_id = v_project_id
          and m.user_id = mentionee_id
      )
    );
end;
$$;

notify pgrst, 'reload schema';
