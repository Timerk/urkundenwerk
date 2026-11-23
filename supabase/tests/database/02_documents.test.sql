-- Document isolation and the role matrix, with fixtures that are independent
-- of supabase/seed.sql. Statements run as the `authenticated` role with JWT
-- claims, the same way PostgREST runs requests.
begin;
create extension if not exists pgtap with schema extensions;

select plan(43);

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
-- one user without any membership. Each tenant starts with one document.
-- ---------------------------------------------------------------------------

insert into auth.users (id, aud, role, email)
values
  ('20000000-0000-4000-8000-00000000a001', 'authenticated', 'authenticated', 'a-admin@documents.test'),
  ('20000000-0000-4000-8000-00000000a002', 'authenticated', 'authenticated', 'a-editor@documents.test'),
  ('20000000-0000-4000-8000-00000000a003', 'authenticated', 'authenticated', 'a-viewer@documents.test'),
  ('20000000-0000-4000-8000-00000000b001', 'authenticated', 'authenticated', 'b-admin@documents.test'),
  ('20000000-0000-4000-8000-00000000c001', 'authenticated', 'authenticated', 'outsider@documents.test');

insert into public.tenants (id, name, slug)
values
  ('20000000-0000-4000-8000-0000000000aa', 'Tenant A', 'documents-tenant-a'),
  ('20000000-0000-4000-8000-0000000000bb', 'Tenant B', 'documents-tenant-b');

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  ('20000000-0000-4000-8000-0000000000aa', '20000000-0000-4000-8000-00000000a001', 'admin'),
  ('20000000-0000-4000-8000-0000000000aa', '20000000-0000-4000-8000-00000000a002', 'editor'),
  ('20000000-0000-4000-8000-0000000000aa', '20000000-0000-4000-8000-00000000a003', 'viewer'),
  ('20000000-0000-4000-8000-0000000000bb', '20000000-0000-4000-8000-00000000b001', 'admin');

insert into public.documents (id, tenant_id, template_id, template_version, title, data, created_by, updated_at)
values
  ('20000000-0000-4000-8000-0000000d00a1', '20000000-0000-4000-8000-0000000000aa',
   'musterprotokoll-einpersonen', '2022-08-01', 'Document of A', '{"contribution": "full"}',
   '20000000-0000-4000-8000-00000000a002', '2000-01-01T00:00:00Z'),
  ('20000000-0000-4000-8000-0000000d00b1', '20000000-0000-4000-8000-0000000000bb',
   'musterprotokoll-einpersonen', '2022-08-01', 'Document of B', '{}',
   '20000000-0000-4000-8000-00000000b001', '2000-01-01T00:00:00Z');

-- ---------------------------------------------------------------------------
-- Reads are limited to the caller's tenants
-- ---------------------------------------------------------------------------

select pg_temp.sign_in_as('20000000-0000-4000-8000-00000000a003');

select results_eq(
  $$ select title from public.documents $$,
  array['Document of A'],
  'a viewer of A reads the documents of A only'
);

select pg_temp.sign_in_as('20000000-0000-4000-8000-00000000b001');

select results_eq(
  $$ select title from public.documents $$,
  array['Document of B'],
  'an admin of B reads the documents of B only'
);

select is_empty(
  $$ select 1 from public.documents where id = '20000000-0000-4000-8000-0000000d00a1' $$,
  'an admin of B cannot read a document of A by id'
);

select pg_temp.sign_in_as('20000000-0000-4000-8000-00000000c001');

select is_empty($$ select 1 from public.documents $$, 'a user without membership reads no documents');

-- ---------------------------------------------------------------------------
-- Insert: editors and admins of the tenant, as themselves
-- ---------------------------------------------------------------------------

select pg_temp.sign_in_as('20000000-0000-4000-8000-00000000a002');

select lives_ok(
  $$ insert into public.documents (tenant_id, template_id, template_version, title)
     values ('20000000-0000-4000-8000-0000000000aa', 'musterprotokoll-einpersonen',
             '2022-08-01', 'Created by the editor') $$,
  'an editor can create a document in their tenant'
);

select results_eq(
  $$ select created_by, status::text, data from public.documents
     where title = 'Created by the editor' $$,
  $$ values ('20000000-0000-4000-8000-00000000a002'::uuid, 'draft', '{}'::jsonb) $$,
  'a new document defaults to an empty draft created by the caller'
);

select throws_ok(
  $$ insert into public.documents (tenant_id, template_id, template_version, title, created_by)
     values ('20000000-0000-4000-8000-0000000000aa', 'musterprotokoll-einpersonen',
             '2022-08-01', 'Spoofed author', '20000000-0000-4000-8000-00000000a001') $$,
  '42501',
  null,
  'an editor cannot create a document on behalf of another user'
);

select throws_ok(
  $$ insert into public.documents (tenant_id, template_id, template_version, title, created_by)
     values ('20000000-0000-4000-8000-0000000000aa', 'musterprotokoll-einpersonen',
             '2022-08-01', 'Anonymous author', null) $$,
  '42501',
  null,
  'an editor cannot create a document without an author'
);

select throws_ok(
  $$ insert into public.documents (tenant_id, template_id, template_version, title)
     values ('20000000-0000-4000-8000-0000000000bb', 'musterprotokoll-einpersonen',
             '2022-08-01', 'Planted in B') $$,
  '42501',
  null,
  'an editor of A cannot create a document in B'
);

select throws_ok(
  $$ insert into public.documents (id, tenant_id, template_id, template_version, title)
     values ('20000000-0000-4000-8000-0000000d00ff', '20000000-0000-4000-8000-0000000000aa',
             'musterprotokoll-einpersonen', '2022-08-01', 'Chosen id') $$,
  '42501',
  null,
  'document ids are generated by the database'
);

select pg_temp.sign_in_as('20000000-0000-4000-8000-00000000a001');

select lives_ok(
  $$ insert into public.documents (tenant_id, template_id, template_version, title)
     values ('20000000-0000-4000-8000-0000000000aa', 'musterprotokoll-einpersonen',
             '2022-08-01', 'Created by the admin') $$,
  'an admin can create a document in their tenant'
);

select pg_temp.sign_in_as('20000000-0000-4000-8000-00000000a003');

select throws_ok(
  $$ insert into public.documents (tenant_id, template_id, template_version, title)
     values ('20000000-0000-4000-8000-0000000000aa', 'musterprotokoll-einpersonen',
             '2022-08-01', 'Created by the viewer') $$,
  '42501',
  null,
  'a viewer cannot create documents'
);

select pg_temp.sign_in_as('20000000-0000-4000-8000-00000000c001');

select throws_ok(
  $$ insert into public.documents (tenant_id, template_id, template_version, title)
     values ('20000000-0000-4000-8000-0000000000aa', 'musterprotokoll-einpersonen',
             '2022-08-01', 'Created by an outsider') $$,
  '42501',
  null,
  'a user without membership cannot create documents'
);

-- ---------------------------------------------------------------------------
-- Update: editors and admins of the tenant, mutable columns only
-- ---------------------------------------------------------------------------

select pg_temp.sign_in_as('20000000-0000-4000-8000-00000000a003');

update public.documents set title = 'Renamed by the viewer', data = '{"x": 1}'
where id = '20000000-0000-4000-8000-0000000d00a1';

select pg_temp.sign_in_as('20000000-0000-4000-8000-00000000b001');

update public.documents set title = 'Renamed by B', data = '{"x": 1}'
where id = '20000000-0000-4000-8000-0000000d00a1';

select pg_temp.sign_in_as('20000000-0000-4000-8000-00000000c001');

update public.documents set title = 'Renamed by an outsider'
where id = '20000000-0000-4000-8000-0000000d00a1';

reset role;

select results_eq(
  $$ select title, data from public.documents where id = '20000000-0000-4000-8000-0000000d00a1' $$,
  $$ values ('Document of A', '{"contribution": "full"}'::jsonb) $$,
  'viewers, other tenants, and outsiders cannot update a document'
);

select pg_temp.sign_in_as('20000000-0000-4000-8000-00000000a002');

select lives_ok(
  $$ update public.documents
     set title = 'Renamed by the editor', data = '{"contribution": "half"}'
     where id = '20000000-0000-4000-8000-0000000d00a1' $$,
  'an editor can update the title and data'
);

select results_eq(
  $$ select title, data->>'contribution', updated_at > '2000-01-01T00:00:00Z'
     from public.documents where id = '20000000-0000-4000-8000-0000000d00a1' $$,
  $$ values ('Renamed by the editor', 'half', true) $$,
  'an update is stored and touches updated_at'
);

select pg_temp.sign_in_as('20000000-0000-4000-8000-00000000a001');

select lives_ok(
  $$ update public.documents set status = 'draft'
     where id = '20000000-0000-4000-8000-0000000d00a1' $$,
  'an admin can update the status'
);

select pg_temp.sign_in_as('20000000-0000-4000-8000-00000000a002');

select throws_ok(
  $$ update public.documents set template_id = 'another-template'
     where id = '20000000-0000-4000-8000-0000000d00a1' $$,
  '42501',
  null,
  'the template is immutable'
);

select throws_ok(
  $$ update public.documents set template_version = '2099-01-01'
     where id = '20000000-0000-4000-8000-0000000d00a1' $$,
  '42501',
  null,
  'the template version is immutable'
);

select throws_ok(
  $$ update public.documents set tenant_id = '20000000-0000-4000-8000-0000000000bb'
     where id = '20000000-0000-4000-8000-0000000d00a1' $$,
  '42501',
  null,
  'a document cannot be moved to another tenant'
);

select throws_ok(
  $$ update public.documents set created_by = '20000000-0000-4000-8000-00000000a001'
     where id = '20000000-0000-4000-8000-0000000d00a1' $$,
  '42501',
  null,
  'the author cannot be changed'
);

select throws_ok(
  $$ update public.documents set created_at = now()
     where id = '20000000-0000-4000-8000-0000000d00a1' $$,
  '42501',
  null,
  'the creation time cannot be changed'
);

-- ---------------------------------------------------------------------------
-- Constraints
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ update public.documents set title = '  padded  '
     where id = '20000000-0000-4000-8000-0000000d00a1' $$,
  '23514',
  null,
  'titles must be trimmed'
);

select throws_ok(
  $$ update public.documents set title = repeat('x', 121)
     where id = '20000000-0000-4000-8000-0000000d00a1' $$,
  '23514',
  null,
  'titles have at most 120 characters'
);

select throws_ok(
  $$ update public.documents set data = '[]'
     where id = '20000000-0000-4000-8000-0000000d00a1' $$,
  '23514',
  null,
  'data must be a JSON object'
);

select throws_ok(
  $$ update public.documents set data = jsonb_build_object('notes', repeat('x', 70000))
     where id = '20000000-0000-4000-8000-0000000d00a1' $$,
  '23514',
  null,
  'data is limited in size'
);

select throws_ok(
  $$ update public.documents set status = 'archived'
     where id = '20000000-0000-4000-8000-0000000d00a1' $$,
  '22P02',
  null,
  'the status is one of draft and final'
);

select throws_ok(
  $$ insert into public.documents (tenant_id, template_id, template_version, title)
     values ('20000000-0000-4000-8000-0000000000aa', 'Not A Template',
             '2022-08-01', 'Bad template id') $$,
  '23514',
  null,
  'template ids are slugs'
);

-- ---------------------------------------------------------------------------
-- Delete: editors and admins of the tenant
-- ---------------------------------------------------------------------------

select pg_temp.sign_in_as('20000000-0000-4000-8000-00000000a003');

delete from public.documents where id = '20000000-0000-4000-8000-0000000d00a1';

select pg_temp.sign_in_as('20000000-0000-4000-8000-00000000b001');

delete from public.documents where id = '20000000-0000-4000-8000-0000000d00a1';

select pg_temp.sign_in_as('20000000-0000-4000-8000-00000000c001');

delete from public.documents where id = '20000000-0000-4000-8000-0000000d00a1';

select pg_temp.sign_in_as('20000000-0000-4000-8000-00000000a002');

delete from public.documents where tenant_id = '20000000-0000-4000-8000-0000000000bb';

reset role;

select is(
  (select count(*)::int from public.documents
   where id in ('20000000-0000-4000-8000-0000000d00a1', '20000000-0000-4000-8000-0000000d00b1')),
  2,
  'viewers, other tenants, and outsiders cannot delete a document'
);

select pg_temp.sign_in_as('20000000-0000-4000-8000-00000000a002');

select lives_ok(
  $$ delete from public.documents where title = 'Created by the editor' $$,
  'an editor can delete a document of their tenant'
);

select pg_temp.sign_in_as('20000000-0000-4000-8000-00000000a001');

select lives_ok(
  $$ delete from public.documents where title = 'Created by the admin' $$,
  'an admin can delete a document of their tenant'
);

reset role;

select is(
  (select count(*)::int from public.documents where tenant_id = '20000000-0000-4000-8000-0000000000aa'),
  1,
  'deleted documents are gone'
);

-- ---------------------------------------------------------------------------
-- Membership changes take effect immediately
-- ---------------------------------------------------------------------------

select pg_temp.sign_in_as('20000000-0000-4000-8000-00000000a001');

select lives_ok(
  $$ update public.tenant_memberships set role = 'viewer'
     where tenant_id = '20000000-0000-4000-8000-0000000000aa'
       and user_id = '20000000-0000-4000-8000-00000000a002' $$,
  'an admin demotes the editor to viewer'
);

select pg_temp.sign_in_as('20000000-0000-4000-8000-00000000a002');

update public.documents set title = 'Renamed after demotion'
where id = '20000000-0000-4000-8000-0000000d00a1';

select results_eq(
  $$ select title from public.documents where id = '20000000-0000-4000-8000-0000000d00a1' $$,
  array['Renamed by the editor'],
  'a demoted editor can still read but no longer update'
);

select pg_temp.sign_in_as('20000000-0000-4000-8000-00000000a001');

select lives_ok(
  $$ delete from public.tenant_memberships
     where tenant_id = '20000000-0000-4000-8000-0000000000aa'
       and user_id = '20000000-0000-4000-8000-00000000a002' $$,
  'an admin removes the former editor'
);

select pg_temp.sign_in_as('20000000-0000-4000-8000-00000000a002');

select is_empty($$ select 1 from public.documents $$, 'a removed member reads no documents');

-- ---------------------------------------------------------------------------
-- Anonymous requests
-- ---------------------------------------------------------------------------

reset role;
select set_config('request.jwt.claims', '{"role": "anon"}', true);
set local role anon;

select throws_ok($$ select 1 from public.documents $$, '42501', null, 'anon cannot read documents');
select throws_ok(
  $$ insert into public.documents (tenant_id, template_id, template_version, title)
     values ('20000000-0000-4000-8000-0000000000aa', 'musterprotokoll-einpersonen', '2022-08-01', 'Anon') $$,
  '42501',
  null,
  'anon cannot create documents'
);
select throws_ok(
  $$ delete from public.documents $$,
  '42501',
  null,
  'anon cannot delete documents'
);

-- ---------------------------------------------------------------------------
-- Cascades
-- ---------------------------------------------------------------------------

reset role;

select lives_ok(
  $$ delete from auth.users where id = '20000000-0000-4000-8000-00000000a002' $$,
  'deleting an author keeps their documents'
);

select is(
  (select created_by from public.documents where id = '20000000-0000-4000-8000-0000000d00a1'),
  null,
  'the author of a document of a deleted user is cleared'
);

select lives_ok(
  $$ delete from public.tenants where id = '20000000-0000-4000-8000-0000000000bb' $$,
  'an operator deletes tenant B'
);

select is(
  (select count(*)::int from public.documents where tenant_id = '20000000-0000-4000-8000-0000000000bb'),
  0,
  'deleting a tenant deletes its documents'
);

select * from finish();
rollback;
