-- Local Guest Mode demo identity.
-- Applied on `supabase db reset` together with `seed-guest-dataset.sql`
-- (see config.toml [db.seed] sql_paths).
--
-- Credentials (local-only; safe to share in docs — never reuse for remote prod):
--   email:    demo@plotops.app
--   password: plotops-demo-local
--
-- Frontend mirror: GUEST_DEMO_USER_ID / GUEST_DEMO_EMAIL in
--   src/features/auth/lib/is-guest-session.ts
-- App env (optional for sign-in CTA in later slice):
--   VITE_GUEST_EMAIL=demo@plotops.app
--   VITE_GUEST_PASSWORD=plotops-demo-local
--
-- Dataset: supabase/seed-guest-dataset.sql
-- Remote PlotOps: create the auth user once, then run that file in SQL Editor —
-- never wipe prod via CI. Procedure: docs/SUPABASE.md → Guest Mode.

-- Fixed UUID must match GUEST_DEMO_USER_ID in the frontend helper.
-- Hash via pgcrypto in the extensions schema (local Supabase default).
insert into auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_app_meta_data,
  raw_user_meta_data,
  created_at,
  updated_at,
  confirmation_token,
  email_change,
  email_change_token_new,
  recovery_token
)
values (
  '00000000-0000-0000-0000-000000000000',
  'a0000000-0000-4000-8000-000000000001',
  'authenticated',
  'authenticated',
  'demo@plotops.app',
  extensions.crypt('plotops-demo-local', extensions.gen_salt('bf')),
  now(),
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object(
    'first_name', 'Demo',
    'last_name', 'Guest',
    'user_name', 'demo'
  ),
  now(),
  now(),
  '',
  '',
  '',
  ''
)
on conflict (id) do nothing;

-- Required for GoTrue email/password sign-in.
insert into auth.identities (
  id,
  user_id,
  identity_data,
  provider,
  provider_id,
  last_sign_in_at,
  created_at,
  updated_at
)
values (
  'a0000000-0000-4000-8000-000000000001',
  'a0000000-0000-4000-8000-000000000001',
  jsonb_build_object(
    'sub', 'a0000000-0000-4000-8000-000000000001',
    'email', 'demo@plotops.app',
    'email_verified', true,
    'phone_verified', false
  ),
  'email',
  'a0000000-0000-4000-8000-000000000001',
  now(),
  now(),
  now()
)
on conflict (provider_id, provider) do nothing;

-- Prefer an explicit profiles upsert (trigger also inserts on auth.users); guarantees
-- a complete row even if the user already existed (on conflict do nothing above).
insert into public.profiles (id, username, avatar_url, first_name, last_name)
values (
  'a0000000-0000-4000-8000-000000000001',
  'demo',
  null,
  'Demo',
  'Guest'
)
on conflict (id) do update
set
  username = coalesce(nullif(trim(public.profiles.username), ''), excluded.username),
  first_name = coalesce(
    nullif(trim(public.profiles.first_name), ''),
    excluded.first_name
  ),
  last_name = coalesce(
    nullif(trim(public.profiles.last_name), ''),
    excluded.last_name
  );
