-- Locale-aware inbox search: match UI phrases via kinds + remapped priority tokens.

drop function if exists public.list_notifications_for_recipient(text, uuid, int, int);

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
  end if;

  return query
  select n.*
  from public.notifications as n
  where n.recipient_id = actor
    and (p_project_id is null or n.project_id = p_project_id)
    and (
      v_q is null
      or n.task_key ilike v_pattern escape '\'
      or n.task_title ilike v_pattern escape '\'
      or n.kind ilike v_pattern escape '\'
      or n.metadata::text ilike v_pattern escape '\'
      or exists (
        select 1
        from public.projects as p
        where p.id = n.project_id
          and p.name ilike v_pattern escape '\'
      )
      or (v_kinds is not null and n.kind = any (v_kinds))
      or (
        v_extra is not null
        and exists (
          select 1
          from unnest(v_extra) as extra(token)
          where n.metadata::text ilike
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
    )
  order by n.read_at asc nulls first, n.created_at desc
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
