-- Hosted demo only. Create the five confirmed Auth users before running this
-- file (docs/deployment.md, step 4). Their passwords are provisioned through
-- Auth and are absent from SQL. Running the file again changes nothing that
-- is already in place, so it can also add a firm or account that is missing.
do $$
declare
  north constant uuid := '6b14210c-97db-41c4-80ae-0366e8f23aa1';
  south constant uuid := '6b14210c-97db-41c4-80ae-0366e8f23bb2';
  west constant uuid := '6b14210c-97db-41c4-80ae-0366e8f23cc3';
  admin_id uuid;
  sara_id uuid;
  editor_id uuid;
  viewer_id uuid;
  multi_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('urkundenwerk:hosted_demo', 0));

  select id into admin_id from auth.users
    where lower(email) = 'anna.admin@demo.test' and email_confirmed_at is not null;
  select id into sara_id from auth.users
    where lower(email) = 'sara.admin@demo.test' and email_confirmed_at is not null;
  select id into editor_id from auth.users
    where lower(email) = 'erik.editor@demo.test' and email_confirmed_at is not null;
  select id into viewer_id from auth.users
    where lower(email) = 'victor.viewer@demo.test' and email_confirmed_at is not null;
  select id into multi_id from auth.users
    where lower(email) = 'mia.multi@demo.test' and email_confirmed_at is not null;

  if admin_id is null or sara_id is null or editor_id is null or viewer_id is null or multi_id is null then
    raise exception 'Create the five confirmed demo Auth users before seeding.';
  end if;

  -- With public sign-up disabled, the operator creates these users. Store the
  -- marker in app metadata, which users cannot change themselves. Visitor
  -- accounts cannot create firms.
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"urkundenwerk_demo": true}'
  where id in (sara_id, editor_id, viewer_id, multi_id)
    and not coalesce(raw_app_meta_data, '{}'::jsonb) @> '{"urkundenwerk_demo": true}';

  insert into public.tenants (id, name, slug) values
    (north, 'Demo-Kanzlei Nord', 'hosted-demo-nord'),
    (south, 'Demo-Kanzlei Süd', 'hosted-demo-sued'),
    (west, 'Demo-Kanzlei West', 'hosted-demo-west')
  on conflict (id) do nothing;

  if not exists (select 1 from public.tenants where id = north and slug = 'hosted-demo-nord')
    or not exists (select 1 from public.tenants where id = south and slug = 'hosted-demo-sued')
    or not exists (select 1 from public.tenants where id = west and slug = 'hosted-demo-west') then
    raise exception 'Hosted demo firm IDs belong to unexpected tenants.';
  end if;

  -- Anna administers Nord and Süd and stays out of the West sandbox, where
  -- visitors act as Sara. The admin rows come first so that a role change
  -- never leaves a firm without an admin.
  insert into public.tenant_memberships as membership (tenant_id, user_id, role) values
    (north, admin_id, 'admin'),
    (south, admin_id, 'admin'),
    (west, sara_id, 'admin')
  on conflict (tenant_id, user_id) do update set role = excluded.role
    where membership.role is distinct from excluded.role;
  insert into public.tenant_memberships as membership (tenant_id, user_id, role) values
    (north, editor_id, 'editor'),
    (north, viewer_id, 'viewer'),
    (north, multi_id, 'editor'),
    (south, multi_id, 'viewer'),
    (west, editor_id, 'editor'),
    (west, viewer_id, 'viewer')
  on conflict (tenant_id, user_id) do update set role = excluded.role
    where membership.role is distinct from excluded.role;

  update public.profiles
  set display_name = case user_id
    when admin_id then 'Anna Admin'
    when sara_id then 'Sara Admin'
    when editor_id then 'Erik Editor'
    when viewer_id then 'Victor Viewer'
    when multi_id then 'Mia Multi'
  end
  where user_id in (admin_id, sara_id, editor_id, viewer_id, multi_id);
end;
$$;
