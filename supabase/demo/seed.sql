-- Hosted demo only. Create the four confirmed Auth users before running this file.
-- Their passwords are provisioned through Auth and are absent from SQL.
do $$
declare
  north constant uuid := '6b14210c-97db-41c4-80ae-0366e8f23aa1';
  south constant uuid := '6b14210c-97db-41c4-80ae-0366e8f23bb2';
  admin_id uuid;
  editor_id uuid;
  viewer_id uuid;
  multi_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('urkundenwerk:hosted_demo', 0));

  select id into admin_id from auth.users
    where email = 'anna.admin@demo.test' and email_confirmed_at is not null;
  select id into editor_id from auth.users
    where email = 'erik.editor@demo.test' and email_confirmed_at is not null;
  select id into viewer_id from auth.users
    where email = 'victor.viewer@demo.test' and email_confirmed_at is not null;
  select id into multi_id from auth.users
    where email = 'mia.multi@demo.test' and email_confirmed_at is not null;

  if admin_id is null or editor_id is null or viewer_id is null or multi_id is null then
    raise exception 'Create the four confirmed demo Auth users before seeding.';
  end if;

  -- With public sign-up disabled, the operator creates these users. Store the
  -- marker in app metadata, which users cannot change themselves.
  update auth.users
  set raw_app_meta_data = coalesce(raw_app_meta_data, '{}'::jsonb) || '{"urkundenwerk_demo": true}'
  where id in (editor_id, viewer_id, multi_id);

  insert into public.tenants (id, name, slug) values
    (north, 'Demo-Kanzlei Nord', 'hosted-demo-nord'),
    (south, 'Demo-Kanzlei Süd', 'hosted-demo-sued')
  on conflict (id) do nothing;

  if not exists (select 1 from public.tenants where id = north and slug = 'hosted-demo-nord')
    or not exists (select 1 from public.tenants where id = south and slug = 'hosted-demo-sued') then
    raise exception 'Hosted demo firm IDs belong to unexpected tenants.';
  end if;

  insert into public.tenant_memberships (tenant_id, user_id, role) values
    (north, admin_id, 'admin'),
    (south, admin_id, 'admin'),
    (north, editor_id, 'editor'),
    (north, viewer_id, 'viewer'),
    (north, multi_id, 'editor'),
    (south, multi_id, 'viewer')
  on conflict (tenant_id, user_id) do update set role = excluded.role;

  update public.profiles
  set display_name = case user_id
    when admin_id then 'Anna Admin'
    when editor_id then 'Erik Editor'
    when viewer_id then 'Victor Viewer'
    when multi_id then 'Mia Multi'
  end
  where user_id in (admin_id, editor_id, viewer_id, multi_id);
end;
$$;
