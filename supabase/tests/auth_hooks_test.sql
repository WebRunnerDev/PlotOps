-- Wave 3 auth hooks (Postgres)
begin;
create extension if not exists pgtap with schema extensions;

select plan(9);

set local role postgres;

-- before_user_created_hook
select is(
  public.before_user_created_hook(
    jsonb_build_object(
      'metadata', jsonb_build_object('ip_address', '127.0.0.1'),
      'user', jsonb_build_object(
        'is_anonymous', false,
        'email', 'new@test.com',
        'app_metadata', jsonb_build_object('provider', 'email')
      )
    )
  ),
  '{}'::jsonb,
  'allows email sign-up with address'
);

select ok(
  (public.before_user_created_hook(
    jsonb_build_object(
      'user', jsonb_build_object('is_anonymous', true)
    )
  )->'error'->>'message') is not null,
  'rejects anonymous sign-up'
);

select ok(
  (public.before_user_created_hook(
    jsonb_build_object(
      'user', jsonb_build_object(
        'is_anonymous', false,
        'email', '',
        'app_metadata', jsonb_build_object('provider', 'email')
      )
    )
  )->'error'->>'message') is not null,
  'rejects email provider without email'
);

select ok(
  public.before_user_created_hook(
    jsonb_build_object(
      'user', jsonb_build_object(
        'is_anonymous', false,
        'email', '',
        'app_metadata', jsonb_build_object('provider', 'github')
      )
    )
  ) = '{}'::jsonb,
  'allows OAuth sign-up without email'
);

-- custom_access_token_hook — use demo seed user (profile exists after db reset seed)
select is(
  (select username from public.profiles where id = 'a0000000-0000-4000-8000-000000000001'::uuid),
  'demo',
  'demo profile visible in test'
);

select is(
  public.custom_access_token_hook(
    jsonb_build_object(
      'user_id', 'a0000000-0000-4000-8000-000000000001',
      'claims', jsonb_build_object(
        'sub', 'a0000000-0000-4000-8000-000000000001',
        'role', 'authenticated'
      )
    )
  )->'claims'->'user_metadata'->>'username',
  'demo',
  'injects profiles.username into JWT user_metadata'
);

select is(
  public.custom_access_token_hook(
    jsonb_build_object(
      'user_id', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
      'claims', jsonb_build_object('sub', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
    )
  )->'claims'->'user_metadata'->>'username',
  null,
  'passes through when profile missing'
);

select has_function(
  'public',
  'before_user_created_hook',
  array['jsonb'],
  'before_user_created_hook exists'
);

select has_function(
  'public',
  'custom_access_token_hook',
  array['jsonb'],
  'custom_access_token_hook exists'
);

select * from finish();
rollback;
