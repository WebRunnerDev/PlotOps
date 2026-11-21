-- Notifications: record who did it (Actor) and list the inbox chronologically.
--
-- 1. `actor_id` defaults to auth.uid(), so every existing fan-out RPC
--    (security definer, called with the acting user's JWT) fills it without
--    changes. Service-role callers (GitHub webhook) leave it null; the client
--    shows "GitHub" from metadata.source. No FK: an Actor without a profile
--    row must never fail a fan-out insert.
-- 2. Backfill from mention metadata, the only kind that stored the Actor.
-- 3. list_notifications_for_recipient returns the Actor's profile fields and
--    orders by created_at only: marking a row read no longer moves it.

alter table public.notifications
  add column if not exists actor_id uuid default auth.uid();

update public.notifications
set actor_id = (metadata -> 'actor' ->> 'id')::uuid
where actor_id is null
  and kind = 'mention'
  and (metadata -> 'actor' ->> 'id') ~*
    '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';

drop function if exists public.list_notifications_for_recipient(
  text,
  uuid,
  int,
  int,
  text[],
  text[]
);

create or replace function public.list_notifications_for_recipient(
  p_q text default null,
  p_project_id uuid default null,
  p_limit int default 30,
  p_offset int default 0,
  p_matched_kinds text[] default null,
  p_extra_patterns text[] default null
)
returns table (
  id uuid,
  recipient_id uuid,
  project_id uuid,
  task_id uuid,
  kind text,
  task_key text,
  task_title text,
  metadata jsonb,
  read_at timestamptz,
  created_at timestamptz,
  actor_id uuid,
  actor_first_name text,
  actor_last_name text,
  actor_username text,
  actor_avatar_url text
)
language plpgsql
security invoker
set search_path = ''
as $$
#variable_conflict use_column
declare
  actor uuid := (select auth.uid());
  v_q text;
  v_pattern text;
  v_limit int;
  v_offset int;
  v_kinds text[];
  v_extra text[];
  v_tsquery tsquery;
begin
  if actor is null then
    return;
  end if;

  v_limit := greatest(1, coalesce(p_limit, 30));
  v_offset := greatest(0, coalesce(p_offset, 0));
  v_q := nullif(btrim(coalesce(p_q, '')), '');
  v_kinds := nullif(p_matched_kinds, '{}'::text[]);
  v_extra := nullif(p_extra_patterns, '{}'::text[]);

  if v_q is not null then
    v_pattern :=
      '%'
      || replace(replace(replace(v_q, '\', '\\'), '%', '\%'), '_', '\_')
      || '%';

    begin
      v_tsquery :=
        coalesce(plainto_tsquery('russian', v_q), ''::tsquery)
        || coalesce(plainto_tsquery('english', v_q), ''::tsquery)
        || coalesce(plainto_tsquery('simple', v_q), ''::tsquery);
    exception
      when others then
        v_tsquery := ''::tsquery;
    end;
  end if;

  return query
  select
    matched.id,
    matched.recipient_id,
    matched.project_id,
    matched.task_id,
    matched.kind,
    matched.task_key,
    matched.task_title,
    matched.metadata,
    matched.read_at,
    matched.created_at,
    matched.actor_id,
    actor_profile.first_name,
    actor_profile.last_name,
    actor_profile.username,
    actor_profile.avatar_url
  from (
    select
      n.*,
      public.notification_search_document(
        n.task_key,
        n.task_title,
        n.kind,
        n.metadata,
        p.name
      ) as search_doc
    from public.notifications as n
    left join public.projects as p on p.id = n.project_id
    where n.recipient_id = actor
      and (p_project_id is null or n.project_id = p_project_id)
  ) as matched
  -- Profiles RLS: only teammates' profiles resolve; others stay null.
  left join public.profiles as actor_profile
    on actor_profile.id = matched.actor_id
  where
    v_q is null
    or matched.task_key ilike v_pattern escape '\'
    or matched.task_title ilike v_pattern escape '\'
    or matched.kind ilike v_pattern escape '\'
    or matched.metadata::text ilike v_pattern escape '\'
    or matched.search_doc ilike v_pattern escape '\'
    or (v_kinds is not null and matched.kind = any (v_kinds))
    or (
      v_extra is not null
      and exists (
        select 1
        from unnest(v_extra) as extra(token)
        where matched.metadata::text ilike
          (
            '%'
            || replace(
              replace(replace(extra.token, '\', '\\'), '%', '\%'),
              '_',
              '\_'
            )
            || '%'
          ) escape '\'
      )
    )
    or (
      v_q is not null
      and (
        (
          to_tsvector('russian', matched.search_doc)
          || to_tsvector('english', matched.search_doc)
          || to_tsvector('simple', matched.search_doc)
        ) @@ coalesce(v_tsquery, ''::tsquery)
        or extensions.word_similarity(lower(v_q), lower(matched.search_doc))
          >= 0.4
        or extensions.similarity(
          lower(coalesce(matched.task_title, '')),
          lower(v_q)
        ) >= 0.3
        or extensions.similarity(
          lower(coalesce(matched.task_key, '')),
          lower(v_q)
        ) >= 0.4
      )
    )
  order by matched.created_at desc, matched.id desc
  limit v_limit
  offset v_offset;
end;
$$;

revoke all on function public.list_notifications_for_recipient(
  text,
  uuid,
  int,
  int,
  text[],
  text[]
) from public;
grant execute on function public.list_notifications_for_recipient(
  text,
  uuid,
  int,
  int,
  text[],
  text[]
) to authenticated;
