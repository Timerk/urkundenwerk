-- Tenant isolation and role checks with fixtures that are independent of
-- supabase/seed.sql. Statements run as the `authenticated` role with JWT
-- claims, the same way PostgREST runs requests.
begin;
create extension if not exists pgtap with schema extensions;

select plan(44);

-- Switches to the `authenticated` role with the given user as `auth.uid()`.
-- `reset role` switches back to the test owner.
create function pg_temp.sign_in_as(user_id uuid) returns void
language plpgsql as $$
begin
  perform set_config(
    'request.jwt.claims',
    json_build_object('sub', user_id, 'role', 'authenticated')::text,
    true
  );
  set local role authenticated;
end;
$$;

-- ---------------------------------------------------------------------------
-- Fixtures: tenant A with admin, editor, and viewer; tenant B with an admin;
-- one user without any membership.
-- ---------------------------------------------------------------------------

insert into auth.users (id, aud, role, email)
values
  ('10000000-0000-4000-8000-00000000a001', 'authenticated', 'authenticated', 'a-admin@isolation.test'),
  ('10000000-0000-4000-8000-00000000a002', 'authenticated', 'authenticated', 'a-editor@isolation.test'),
  ('10000000-0000-4000-8000-00000000a003', 'authenticated', 'authenticated', 'a-viewer@isolation.test'),
  ('10000000-0000-4000-8000-00000000b001', 'authenticated', 'authenticated', 'b-admin@isolation.test'),
  ('10000000-0000-4000-8000-00000000c001', 'authenticated', 'authenticated', 'outsider@isolation.test');

insert into public.tenants (id, name, slug)
values
  ('10000000-0000-4000-8000-0000000000aa', 'Tenant A', 'isolation-tenant-a'),
  ('10000000-0000-4000-8000-0000000000bb', 'Tenant B', 'isolation-tenant-b');

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  ('10000000-0000-4000-8000-0000000000aa', '10000000-0000-4000-8000-00000000a001', 'admin'),
  ('10000000-0000-4000-8000-0000000000aa', '10000000-0000-4000-8000-00000000a002', 'editor'),
  ('10000000-0000-4000-8000-0000000000aa', '10000000-0000-4000-8000-00000000a003', 'viewer'),
  ('10000000-0000-4000-8000-0000000000bb', '10000000-0000-4000-8000-00000000b001', 'admin');

select is(
  (select count(*)::int from public.profiles where user_id::text like '10000000-%'),
  5,
  'a profile is created for every new auth user'
);

-- ---------------------------------------------------------------------------
-- Reads are limited to the caller's tenants
-- ---------------------------------------------------------------------------

select pg_temp.sign_in_as('10000000-0000-4000-8000-00000000a001');

select results_eq(
  $$ select name from public.tenants $$,
  array['Tenant A'],
  'an admin of A sees tenant A only'
);

select results_eq(
  $$ select tenant_id from public.tenant_memberships group by tenant_id $$,
  array['10000000-0000-4000-8000-0000000000aa'::uuid],
  'an admin of A sees memberships of A only'
);

select is(
  (select count(*)::int from public.tenant_memberships),
  3,
  'an admin of A sees all three memberships of A'
);

select results_eq(
  $$ select user_id from public.profiles $$,
  array['10000000-0000-4000-8000-00000000a001'::uuid],
  'a user sees only their own profile'
);

select pg_temp.sign_in_as('10000000-0000-4000-8000-00000000a003');

select results_eq(
  $$ select name from public.tenants $$,
  array['Tenant A'],
  'a viewer of A sees tenant A'
);

select pg_temp.sign_in_as('10000000-0000-4000-8000-00000000c001');

select is_empty($$ select 1 from public.tenants $$, 'a user without membership sees no tenants');
select is_empty($$ select 1 from public.tenant_memberships $$, 'a user without membership sees no memberships');

-- ---------------------------------------------------------------------------
-- Writes into another tenant are rejected or affect no rows
-- ---------------------------------------------------------------------------

select pg_temp.sign_in_as('10000000-0000-4000-8000-00000000a001');

select throws_ok(
  $$ insert into public.tenant_memberships (tenant_id, user_id, role)
     values ('10000000-0000-4000-8000-0000000000bb', '10000000-0000-4000-8000-00000000a001', 'admin') $$,
  '42501',
  null,
  'an admin of A cannot add themselves to B'
);

select throws_ok(
  $$ insert into public.tenants (name, slug) values ('Direct Insert', 'direct-insert') $$,
  '42501',
  null,
  'tenants cannot be inserted directly'
);

update public.tenant_memberships set role = 'viewer'
where tenant_id = '10000000-0000-4000-8000-0000000000bb';
update public.tenants set name = 'Renamed by A'
where id = '10000000-0000-4000-8000-0000000000bb';
delete from public.tenant_memberships
where tenant_id = '10000000-0000-4000-8000-0000000000bb';
update public.profiles set display_name = 'Renamed by A'
where user_id = '10000000-0000-4000-8000-00000000b001';

select throws_ok(
  $$ delete from public.tenants where id = '10000000-0000-4000-8000-0000000000bb' $$,
  '42501',
  null,
  'tenants cannot be deleted through the API roles'
);

select throws_ok(
  $$ update public.tenant_memberships set tenant_id = '10000000-0000-4000-8000-0000000000bb'
     where user_id = '10000000-0000-4000-8000-00000000a003' $$,
  '42501',
  null,
  'a membership cannot be moved to another tenant'
);

reset role;

select is(
  (select role::text from public.tenant_memberships
   where tenant_id = '10000000-0000-4000-8000-0000000000bb'
     and user_id = '10000000-0000-4000-8000-00000000b001'),
  'admin',
  'an admin of A cannot update or delete memberships of B'
);

select is(
  (select name from public.tenants where id = '10000000-0000-4000-8000-0000000000bb'),
  'Tenant B',
  'an admin of A cannot rename tenant B'
);

select is(
  (select display_name from public.profiles where user_id = '10000000-0000-4000-8000-00000000b001'),
  null,
  'a user cannot update another user''s profile'
);

-- ---------------------------------------------------------------------------
-- Role checks inside a tenant
-- ---------------------------------------------------------------------------

select pg_temp.sign_in_as('10000000-0000-4000-8000-00000000a002');

update public.tenant_memberships set role = 'admin'
where user_id = '10000000-0000-4000-8000-00000000a002';
update public.tenant_memberships set role = 'editor'
where user_id = '10000000-0000-4000-8000-00000000a003';
delete from public.tenant_memberships
where user_id = '10000000-0000-4000-8000-00000000a003';
update public.tenants set name = 'Renamed by editor'
where id = '10000000-0000-4000-8000-0000000000aa';

select throws_ok(
  $$ insert into public.tenant_memberships (tenant_id, user_id, role)
     values ('10000000-0000-4000-8000-0000000000aa', '10000000-0000-4000-8000-00000000c001', 'viewer') $$,
  '42501',
  null,
  'an editor cannot add members'
);

select pg_temp.sign_in_as('10000000-0000-4000-8000-00000000a003');

update public.tenant_memberships set role = 'admin'
where user_id = '10000000-0000-4000-8000-00000000a003';

select throws_ok(
  $$ insert into public.tenant_memberships (tenant_id, user_id, role)
     values ('10000000-0000-4000-8000-0000000000aa', '10000000-0000-4000-8000-00000000c001', 'viewer') $$,
  '42501',
  null,
  'a viewer cannot add members'
);

reset role;

select results_eq(
  $$ select user_id, role::text from public.tenant_memberships
     where tenant_id = '10000000-0000-4000-8000-0000000000aa' order by user_id $$,
  $$ values
       ('10000000-0000-4000-8000-00000000a001'::uuid, 'admin'),
       ('10000000-0000-4000-8000-00000000a002'::uuid, 'editor'),
       ('10000000-0000-4000-8000-00000000a003'::uuid, 'viewer') $$,
  'editors and viewers cannot change roles, escalate their own role, or remove members'
);

select is(
  (select name from public.tenants where id = '10000000-0000-4000-8000-0000000000aa'),
  'Tenant A',
  'an editor cannot rename the tenant'
);

-- ---------------------------------------------------------------------------
-- Admins manage their own tenant
-- ---------------------------------------------------------------------------

select pg_temp.sign_in_as('10000000-0000-4000-8000-00000000a001');

select lives_ok(
  $$ update public.tenants set name = 'Tenant A Renamed'
     where id = '10000000-0000-4000-8000-0000000000aa' $$,
  'an admin can rename their tenant'
);

select throws_ok(
  $$ update public.tenants set slug = 'stolen-slug'
     where id = '10000000-0000-4000-8000-0000000000aa' $$,
  '42501',
  null,
  'the tenant slug is immutable through the API roles'
);

select throws_ok(
  $$ insert into public.tenant_memberships (tenant_id, user_id, role)
     values ('10000000-0000-4000-8000-0000000000aa', '10000000-0000-4000-8000-00000000c001', 'viewer') $$,
  '42501', null, 'an admin cannot bypass invitation acceptance'
);

reset role;
insert into public.tenant_memberships (tenant_id, user_id, role)
values ('10000000-0000-4000-8000-0000000000aa', '10000000-0000-4000-8000-00000000c001', 'viewer');
select pg_temp.sign_in_as('10000000-0000-4000-8000-00000000a001');

select lives_ok(
  $$ update public.tenant_memberships set role = 'editor'
     where tenant_id = '10000000-0000-4000-8000-0000000000aa'
       and user_id = '10000000-0000-4000-8000-00000000c001' $$,
  'an admin can change a member''s role'
);

select pg_temp.sign_in_as('10000000-0000-4000-8000-00000000c001');

select results_eq(
  $$ select name from public.tenants $$,
  array['Tenant A Renamed'],
  'a new member sees the tenant'
);

select pg_temp.sign_in_as('10000000-0000-4000-8000-00000000a001');

select lives_ok(
  $$ delete from public.tenant_memberships
     where tenant_id = '10000000-0000-4000-8000-0000000000aa'
       and user_id = '10000000-0000-4000-8000-00000000c001' $$,
  'an admin can remove a member'
);

select pg_temp.sign_in_as('10000000-0000-4000-8000-00000000c001');

select is_empty($$ select 1 from public.tenants $$, 'a removed member loses access');

-- ---------------------------------------------------------------------------
-- Every tenant keeps an admin
-- ---------------------------------------------------------------------------

select pg_temp.sign_in_as('10000000-0000-4000-8000-00000000a001');

select throws_ok(
  $$ update public.tenant_memberships set role = 'editor'
     where tenant_id = '10000000-0000-4000-8000-0000000000aa'
       and user_id = '10000000-0000-4000-8000-00000000a001' $$,
  '23514',
  'A tenant must keep at least one admin.',
  'the last admin cannot demote themselves'
);

select throws_ok(
  $$ delete from public.tenant_memberships
     where tenant_id = '10000000-0000-4000-8000-0000000000aa'
       and user_id = '10000000-0000-4000-8000-00000000a001' $$,
  '23514',
  'A tenant must keep at least one admin.',
  'the last admin cannot remove themselves'
);

select lives_ok(
  $$ update public.tenant_memberships set role = 'admin'
     where tenant_id = '10000000-0000-4000-8000-0000000000aa'
       and user_id = '10000000-0000-4000-8000-00000000a002' $$,
  'an admin can promote another member to admin'
);

select lives_ok(
  $$ update public.tenant_memberships set role = 'viewer'
     where tenant_id = '10000000-0000-4000-8000-0000000000aa'
       and user_id = '10000000-0000-4000-8000-00000000a001' $$,
  'an admin can step down while another admin remains'
);

-- ---------------------------------------------------------------------------
-- Profiles
-- ---------------------------------------------------------------------------

select lives_ok(
  $$ update public.profiles set display_name = 'Admin A'
     where user_id = '10000000-0000-4000-8000-00000000a001' $$,
  'a user can update their own display name'
);

select throws_ok(
  $$ update public.profiles set user_id = '10000000-0000-4000-8000-00000000b001'
     where user_id = '10000000-0000-4000-8000-00000000a001' $$,
  '42501',
  null,
  'a user cannot change the owner of a profile'
);

-- ---------------------------------------------------------------------------
-- Anonymous requests
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;

select throws_ok($$ select 1 from public.tenants $$, '42501', null, 'anon cannot read tenants');
select throws_ok($$ select 1 from public.tenant_memberships $$, '42501', null, 'anon cannot read memberships');
select throws_ok($$ select 1 from public.profiles $$, '42501', null, 'anon cannot read profiles');
select throws_ok($$ select public.create_tenant('Anonymous Firm') $$, '42501', null, 'anon cannot create tenants');

-- ---------------------------------------------------------------------------
-- create_tenant
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims', '{"role": "authenticated"}', true);
set local role authenticated;

select throws_ok(
  $$ select public.create_tenant('Kanzlei ohne Nutzer') $$,
  '42501',
  'Not authenticated.',
  'create_tenant requires a signed-in user'
);

select pg_temp.sign_in_as('10000000-0000-4000-8000-00000000c001');

select throws_ok(
  $$ select public.create_tenant('   ') $$,
  '22023',
  'The firm name must have between 2 and 120 characters.',
  'create_tenant rejects a blank name'
);

select throws_ok(
  $$ select public.create_tenant(repeat('x', 121)) $$,
  '22023',
  'The firm name must have between 2 and 120 characters.',
  'create_tenant rejects an overlong name'
);

select lives_ok(
  $$ select public.create_tenant('  Kanzlei Müller & Söhne  ') $$,
  'create_tenant succeeds for a signed-in user'
);

select results_eq(
  $$ select t.name, t.slug, m.role::text
     from public.tenants as t
     join public.tenant_memberships as m on m.tenant_id = t.id $$,
  $$ values ('Kanzlei Müller & Söhne', 'kanzlei-mueller-soehne', 'admin') $$,
  'create_tenant trims the name, derives a slug, and makes the caller admin'
);

select lives_ok(
  $$ select public.create_tenant('Kanzlei Müller & Söhne') $$,
  'create_tenant accepts a name whose slug is already taken'
);

select is(
  (select count(distinct slug)::int from public.tenants),
  2,
  'tenants with the same name get distinct slugs'
);

-- ---------------------------------------------------------------------------
-- Operator deletes cascade past the last-admin check
-- ---------------------------------------------------------------------------

reset role;

select lives_ok(
  $$ delete from public.tenants where id = '10000000-0000-4000-8000-0000000000bb' $$,
  'deleting a tenant removes its memberships, including the last admin'
);

select * from finish();
rollback;
