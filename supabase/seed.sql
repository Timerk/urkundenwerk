-- Local demo data. Every name, firm, and address here is fictional, and the
-- password `demo-password-123` only exists in this local seed.
--
--   anna.admin@demo.test   admin  of Demo-Kanzlei Nord
--   erik.editor@demo.test  editor of Demo-Kanzlei Nord
--   sara.admin@demo.test   admin  of Demo-Kanzlei Süd

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
  recovery_token,
  email_change,
  email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000',
  demo_user.id,
  'authenticated',
  'authenticated',
  demo_user.email,
  extensions.crypt('demo-password-123', extensions.gen_salt('bf')),
  now(),
  '{"provider": "email", "providers": ["email"]}',
  '{}',
  now(),
  now(),
  '',
  '',
  '',
  ''
from (
  values
    ('00000000-0000-4000-8000-00000000a001'::uuid, 'anna.admin@demo.test'),
    ('00000000-0000-4000-8000-00000000a002'::uuid, 'erik.editor@demo.test'),
    ('00000000-0000-4000-8000-00000000b001'::uuid, 'sara.admin@demo.test')
) as demo_user (id, email);

insert into auth.identities (
  id,
  user_id,
  provider_id,
  provider,
  identity_data,
  last_sign_in_at,
  created_at,
  updated_at
)
select
  gen_random_uuid(),
  users.id,
  users.id::text,
  'email',
  jsonb_build_object('sub', users.id::text, 'email', users.email, 'email_verified', true),
  now(),
  now(),
  now()
from auth.users as users
where users.email like '%@demo.test';

insert into public.tenants (id, name, slug)
values
  ('00000000-0000-4000-8000-0000000000aa', 'Demo-Kanzlei Nord', 'demo-kanzlei-nord'),
  ('00000000-0000-4000-8000-0000000000bb', 'Demo-Kanzlei Süd', 'demo-kanzlei-sued');

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  ('00000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-00000000a001', 'admin'),
  ('00000000-0000-4000-8000-0000000000aa', '00000000-0000-4000-8000-00000000a002', 'editor'),
  ('00000000-0000-4000-8000-0000000000bb', '00000000-0000-4000-8000-00000000b001', 'admin');

update public.profiles
set display_name = case user_id
  when '00000000-0000-4000-8000-00000000a001' then 'Anna Admin'
  when '00000000-0000-4000-8000-00000000a002' then 'Erik Editor'
  when '00000000-0000-4000-8000-00000000b001' then 'Sara Admin'
end
where user_id in (
  '00000000-0000-4000-8000-00000000a001',
  '00000000-0000-4000-8000-00000000a002',
  '00000000-0000-4000-8000-00000000b001'
);
