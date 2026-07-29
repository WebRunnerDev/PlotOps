-- Fuzzy + morphological notification search (pg_trgm typos, russian/english FTS stems).

create extension if not exists pg_trgm with schema extensions;
-- UI kind phrases (en+ru) so FTS stemming can match падежи against inbox copy.
create or replace function public.notification_kind_search_text(p_kind text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case p_kind
    when 'assignment' then
      'assignment assigned assignee you were assigned assigned to назначен вас назначили исполнителем'
    when 'assignee_change' then
      'assignee change assignee changed assignee set to исполнитель изменён исполнитель'
    when 'author_change' then
      'author change author changed author set to автор изменён автор'
    when 'board_move' then
      'board move moved to another board перенесена на другую доску'
    when 'deadline_change' then
      'deadline change deadline changed deadline set deadline cleared дедлайн изменён дедлайн снят дедлайн установлен'
    when 'priority_change' then
      'priority change priority changed приоритет изменён urgent high medium low срочный высокий средний низкий без приоритета no priority'
    when 'status_change' then
      'status change status changed статус изменён'
    else coalesce(p_kind, '')
  end;
$$;
create or replace function public.notification_search_document(
  p_task_key text,
  p_task_title text,
  p_kind text,
  p_metadata jsonb,
  p_project_name text
)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  select concat_ws(
    ' ',
    coalesce(p_task_key, ''),
    coalesce(p_task_title, ''),
    coalesce(p_kind, ''),
    coalesce(p_metadata::text, ''),
    coalesce(p_project_name, ''),
    public.notification_kind_search_text(p_kind)
  );
$$;
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
returns setof public.notifications
language plpgsql
security invoker
set search_path = ''
as $$
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
    matched.created_at
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
  order by matched.read_at asc nulls first, matched.created_at desc
  limit v_limit
  offset v_offset;
end;
$$;
revoke all on function public.notification_kind_search_text(text) from public;
grant execute on function public.notification_kind_search_text(text) to authenticated;
revoke all on function public.notification_search_document(
  text,
  text,
  text,
  jsonb,
  text
) from public;
grant execute on function public.notification_search_document(
  text,
  text,
  text,
  jsonb,
  text
) to authenticated;
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
