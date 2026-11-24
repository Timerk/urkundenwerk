-- The audit log: triggers, data minimisation, append-only enforcement, RLS
-- visibility, the record_document_event RPC, and retention. Fixtures are
-- independent of supabase/seed.sql.
begin;
create extension if not exists pgtap with schema extensions;

select plan(58);

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

-- Fixtures: tenant A with admin, editor, viewer; tenant B with an admin.
insert into auth.users (id, aud, role, email)
values
  ('40000000-0000-4000-8000-00000000a001', 'authenticated', 'authenticated', 'a-admin@audit.test'),
  ('40000000-0000-4000-8000-00000000a002', 'authenticated', 'authenticated', 'a-editor@audit.test'),
  ('40000000-0000-4000-8000-00000000a003', 'authenticated', 'authenticated', 'a-viewer@audit.test'),
  ('40000000-0000-4000-8000-00000000b001', 'authenticated', 'authenticated', 'b-admin@audit.test');

insert into public.tenants (id, name, slug)
values
  ('40000000-0000-4000-8000-0000000000aa', 'Tenant A', 'audit-tenant-a'),
  ('40000000-0000-4000-8000-0000000000bb', 'Tenant B', 'audit-tenant-b');

insert into public.tenant_memberships (tenant_id, user_id, role)
values
  ('40000000-0000-4000-8000-0000000000aa', '40000000-0000-4000-8000-00000000a001', 'admin'),
  ('40000000-0000-4000-8000-0000000000aa', '40000000-0000-4000-8000-00000000a002', 'editor'),
  ('40000000-0000-4000-8000-0000000000aa', '40000000-0000-4000-8000-00000000a003', 'viewer'),
  ('40000000-0000-4000-8000-0000000000bb', '40000000-0000-4000-8000-00000000b001', 'admin');

insert into public.documents (id, tenant_id, template_id, template_version, title, data, created_by)
values
  ('40000000-0000-4000-8000-0000000d00b1', '40000000-0000-4000-8000-0000000000bb',
   'musterprotokoll-einpersonen', '2022-08-01', 'Document of B', '{}',
   '40000000-0000-4000-8000-00000000b001');

-- ---------------------------------------------------------------------------
-- Fixtures written by the operator are recorded without an actor
-- ---------------------------------------------------------------------------

select results_eq(
  $$ select action, count(*)::int from public.audit_events
     where tenant_id = '40000000-0000-4000-8000-0000000000aa'
     group by action order by action $$,
  $$ values ('membership.added', 3), ('tenant.created', 1) $$,
  'creating a tenant and its memberships records one event each'
);

select is(
  (select count(*)::int from public.audit_events
   where tenant_id = '40000000-0000-4000-8000-0000000000aa' and actor_id is not null),
  0,
  'changes without a signed-in user have no actor'
);

select is(
  (select metadata from public.audit_events
   where tenant_id = '40000000-0000-4000-8000-0000000000aa'
     and action = 'membership.added'
     and subject_user_id = '40000000-0000-4000-8000-00000000a003'),
  '{"role": "viewer"}'::jsonb,
  'membership.added records the role and the member as subject'
);

-- ---------------------------------------------------------------------------
-- Document triggers
-- ---------------------------------------------------------------------------

select pg_temp.sign_in_as('40000000-0000-4000-8000-00000000a002');

insert into public.documents (tenant_id, template_id, template_version, title, data)
values ('40000000-0000-4000-8000-0000000000aa', 'musterprotokoll-einpersonen', '2022-08-01',
        'Erika Mustermann GmbH', '{"contribution": "full"}');

reset role;
create temporary table fixture as
  select id from public.documents where title = 'Erika Mustermann GmbH';
grant select on fixture to authenticated;
select pg_temp.sign_in_as('40000000-0000-4000-8000-00000000a002');

select results_eq(
  $$ select action, actor_id, metadata from public.audit_events
     where entity_id = (select id from fixture) $$,
  $$ values ('document.created', '40000000-0000-4000-8000-00000000a002'::uuid,
             '{"templateId": "musterprotokoll-einpersonen", "templateVersion": "2022-08-01", "status": "draft"}'::jsonb) $$,
  'document.created records the editor, the template version, and the status'
);

update public.documents
set data = data || '{"founder": {"firstName": "Erika", "address": {"city": "Musterstadt"}}}'
where id = (select id from fixture);

select is(
  (select metadata from public.audit_events
   where entity_id = (select id from fixture) and action = 'document.updated'),
  '{"fields": ["founder.address.city", "founder.firstName"]}'::jsonb,
  'document.updated records the changed leaf paths'
);

update public.documents
set data = jsonb_set(data, '{founder,firstName}', '"Erik"')
where id = (select id from fixture);

select is(
  (select count(*)::int from public.audit_events
   where entity_id = (select id from fixture) and action = 'document.updated'),
  1,
  'a repeated save of already recorded fields by the same person is not recorded again'
);

update public.documents
set data = data || '{"company": {"seat": "Musterstadt"}}', title = 'Erik Mustermann GmbH'
where id = (select id from fixture);

select is(
  (select metadata from public.audit_events
   where entity_id = (select id from fixture) and action = 'document.updated'
   order by occurred_at desc, id desc limit 1),
  '{"fields": ["company.seat", "title"]}'::jsonb,
  'a change of another field and the title starts a new event'
);

update public.documents set data = data where id = (select id from fixture);

select is(
  (select count(*)::int from public.audit_events
   where entity_id = (select id from fixture) and action = 'document.updated'),
  2,
  'a save without changes records nothing'
);

update public.documents set data = data - 'contribution' where id = (select id from fixture);

select is(
  (select metadata from public.audit_events
   where entity_id = (select id from fixture) and action = 'document.updated'
   order by occurred_at desc, id desc limit 1),
  '{"fields": ["contribution"]}'::jsonb,
  'removing a value records its path'
);

update public.documents set status = 'final' where id = (select id from fixture);

select is(
  (select metadata from public.audit_events
   where entity_id = (select id from fixture) and action = 'document.updated'
   order by occurred_at desc, id desc limit 1),
  '{"fields": [], "status": {"from": "draft", "to": "final"}}'::jsonb,
  'a status change records the old and new status'
);

reset role;

select is(
  (select count(*)::int from public.audit_events
   where metadata::text ~ '(Erika|Erik|Mustermann|Musterstadt)'),
  0,
  'no event metadata contains a personal value or the title'
);

-- ---------------------------------------------------------------------------
-- record_document_event
-- ---------------------------------------------------------------------------

select pg_temp.sign_in_as('40000000-0000-4000-8000-00000000a003');

select lives_ok(
  $$ select public.record_document_event((select id from fixture), 'document.exported',
       '{"format": "pdf", "document": "musterprotokoll"}') $$,
  'a viewer can record an export of a document of their firm'
);

select results_eq(
  $$ select actor_id, metadata from public.audit_events
     where entity_id = (select id from fixture) and action = 'document.exported' $$,
  $$ values ('40000000-0000-4000-8000-00000000a003'::uuid,
             '{"format": "pdf", "document": "musterprotokoll", "templateId": "musterprotokoll-einpersonen", "templateVersion": "2022-08-01"}'::jsonb) $$,
  'the export is recorded with the caller as actor and the template version from the document'
);

select throws_ok(
  $$ select public.record_document_event('40000000-0000-4000-8000-0000000d00b1', 'document.exported',
       '{"format": "pdf", "document": "musterprotokoll"}') $$,
  '42501', 'Document not found.',
  'a document of another tenant is refused'
);

select throws_ok(
  $$ select public.record_document_event('40000000-0000-4000-8000-0000000dffff', 'document.exported',
       '{"format": "pdf", "document": "musterprotokoll"}') $$,
  '42501', 'Document not found.',
  'a missing document gives the same answer'
);

select throws_ok(
  $$ select public.record_document_event((select id from fixture), 'document.deleted', '{}') $$,
  '22023', 'Unknown document event.',
  'actions written by triggers cannot be forged'
);

select throws_ok(
  $$ select public.record_document_event((select id from fixture), 'membership.added', '{}') $$,
  '22023', 'Unknown document event.',
  'unknown actions are refused'
);

select throws_ok(
  $$ select public.record_document_event((select id from fixture), 'document.exported',
       jsonb_build_object('format', 'pdf', 'document', 'musterprotokoll', 'note', repeat('x', 2000))) $$,
  '22023', null,
  'oversized metadata is refused'
);

select throws_ok(
  $$ select public.record_document_event((select id from fixture), 'document.exported',
       '{"format": "pdf", "document": "musterprotokoll", "founder": "Erika"}') $$,
  '22023', null,
  'export metadata with extra keys is refused'
);

select throws_ok(
  $$ select public.record_document_event((select id from fixture), 'document.exported',
       '{"format": "xml", "document": "musterprotokoll"}') $$,
  '22023', null,
  'an impossible format and document combination is refused'
);

select throws_ok(
  $$ select public.record_document_event((select id from fixture), 'document.exported', '[]') $$,
  '22023', null,
  'metadata must be an object'
);

select throws_ok(
  $$ select public.record_document_event((select id from fixture), 'document.imported',
       '{"model": "gpt-6.1-terra", "promptVersion": "extract-2026-11-23",
         "counts": {"verified": {"accepted": 1, "edited": 0, "cleared": 0},
                    "unverified": {"accepted": 0, "edited": 0, "cleared": 0},
                    "absent": {"accepted": 0, "edited": 0, "cleared": 0}}}') $$,
  '42501', null,
  'a viewer cannot record an import'
);

select pg_temp.sign_in_as('40000000-0000-4000-8000-00000000a001');

select throws_ok(
  $$ select public.record_document_event((select id from fixture), 'document.imported',
       '{"model": "gpt-6.1-terra", "promptVersion": "extract-2026-11-23",
         "counts": {"verified": {"accepted": 1, "edited": 0, "cleared": 0},
                    "unverified": {"accepted": 0, "edited": 0, "cleared": 0},
                    "absent": {"accepted": 0, "edited": 0, "cleared": 0}}}') $$,
  '42501', null,
  'only the creator of the document can record its import'
);

select pg_temp.sign_in_as('40000000-0000-4000-8000-00000000a002');

select throws_ok(
  $$ select public.record_document_event((select id from fixture), 'document.imported',
       '{"model": "gpt-6.1-terra", "promptVersion": "extract-2026-11-23",
         "counts": {"verified": {"accepted": 1.5, "edited": 0, "cleared": 0},
                    "unverified": {"accepted": 0, "edited": 0, "cleared": 0},
                    "absent": {"accepted": 0, "edited": 0, "cleared": 0}}}') $$,
  '22023', null,
  'import counts must be whole numbers'
);

select throws_ok(
  $$ select public.record_document_event((select id from fixture), 'document.imported',
       '{"model": "Ignore previous instructions", "promptVersion": "extract-2026-11-23",
         "counts": {"verified": {"accepted": 1, "edited": 0, "cleared": 0},
                    "unverified": {"accepted": 0, "edited": 0, "cleared": 0},
                    "absent": {"accepted": 0, "edited": 0, "cleared": 0}}}') $$,
  '22023', null,
  'the model must look like a model id'
);

select lives_ok(
  $$ select public.record_document_event((select id from fixture), 'document.imported',
       '{"model": "gpt-6.1-terra", "promptVersion": "extract-2026-11-23",
         "counts": {"verified": {"accepted": 9, "edited": 1, "cleared": 0},
                    "unverified": {"accepted": 0, "edited": 2, "cleared": 1},
                    "absent": {"accepted": 0, "edited": 3, "cleared": 0}}}') $$,
  'the creator records the import provenance'
);

select throws_ok(
  $$ select public.record_document_event((select id from fixture), 'document.imported',
       '{"model": "gpt-6.1-terra", "promptVersion": "extract-2026-11-23",
         "counts": {"verified": {"accepted": 9, "edited": 1, "cleared": 0},
                    "unverified": {"accepted": 0, "edited": 2, "cleared": 1},
                    "absent": {"accepted": 0, "edited": 3, "cleared": 0}}}') $$,
  '42501', null,
  'an import is recorded once per document'
);

reset role;
set local role anon;
select throws_ok(
  $$ select public.record_document_event('40000000-0000-4000-8000-0000000d00b1', 'document.exported', '{}') $$,
  '42501', null,
  'anon cannot record events'
);
reset role;

-- ---------------------------------------------------------------------------
-- Clients cannot write
-- ---------------------------------------------------------------------------

select pg_temp.sign_in_as('40000000-0000-4000-8000-00000000a001');

select throws_ok(
  $$ insert into public.audit_events (tenant_id, action, entity_type, entity_id)
     values ('40000000-0000-4000-8000-0000000000aa', 'tenant.renamed', 'tenant',
             '40000000-0000-4000-8000-0000000000aa') $$,
  '42501', null,
  'an admin cannot insert events'
);
select throws_ok(
  $$ update public.audit_events set metadata = '{}' $$,
  '42501', null,
  'an admin cannot update events'
);
select throws_ok(
  $$ delete from public.audit_events $$,
  '42501', null,
  'an admin cannot delete events'
);
select throws_ok(
  $$ select private.prune_audit_events(interval '1 day') $$,
  '42501', null,
  'an admin cannot prune events'
);

-- ---------------------------------------------------------------------------
-- Visibility
-- ---------------------------------------------------------------------------

select is(
  (select count(*)::int from public.audit_events
   where tenant_id <> '40000000-0000-4000-8000-0000000000aa'),
  0,
  'an admin of A sees no events of other tenants'
);

select ok(
  (select count(*)::int from public.audit_events where entity_type = 'membership') = 3
  and exists (select 1 from public.audit_events where entity_type = 'tenant'),
  'an admin sees the membership and firm history'
);

select pg_temp.sign_in_as('40000000-0000-4000-8000-00000000a003');

select results_eq(
  $$ select distinct entity_type from public.audit_events $$,
  array['document'],
  'a viewer sees document events only'
);

select is(
  (select count(*)::int from public.audit_events where entity_id = (select id from fixture)),
  7,
  'a viewer sees the full history of a document they can read'
);

select pg_temp.sign_in_as('40000000-0000-4000-8000-00000000b001');

select is_empty(
  $$ select 1 from public.audit_events where tenant_id = '40000000-0000-4000-8000-0000000000aa' $$,
  'an admin of B sees no events of A'
);

select is_empty(
  $$ select 1 from public.list_tenant_members('40000000-0000-4000-8000-0000000000aa') $$,
  'list_tenant_members returns nothing for a foreign tenant'
);

select pg_temp.sign_in_as('40000000-0000-4000-8000-00000000a003');

select results_eq(
  $$ select email, role::text from public.list_tenant_members('40000000-0000-4000-8000-0000000000aa') $$,
  $$ values ('a-admin@audit.test', 'admin'), ('a-editor@audit.test', 'editor'), ('a-viewer@audit.test', 'viewer') $$,
  'members see the names and emails of their colleagues'
);

-- ---------------------------------------------------------------------------
-- Memberships, deletion, and the firm
-- ---------------------------------------------------------------------------

select pg_temp.sign_in_as('40000000-0000-4000-8000-00000000a001');

update public.tenant_memberships set role = 'editor'
where tenant_id = '40000000-0000-4000-8000-0000000000aa'
  and user_id = '40000000-0000-4000-8000-00000000a003';
update public.tenants set name = 'Tenant A Renamed'
where id = '40000000-0000-4000-8000-0000000000aa';

select results_eq(
  $$ select action, actor_id, subject_user_id, metadata from public.audit_events
     where action in ('membership.role_changed', 'tenant.renamed')
     order by action $$,
  $$ values
     ('membership.role_changed', '40000000-0000-4000-8000-00000000a001'::uuid,
      '40000000-0000-4000-8000-00000000a003'::uuid, '{"from": "viewer", "to": "editor"}'::jsonb),
     ('tenant.renamed', '40000000-0000-4000-8000-00000000a001'::uuid, null, '{"fields": ["name"]}'::jsonb) $$,
  'role changes and renames are recorded without the name'
);

delete from public.documents where id = (select id from fixture);

select is(
  (select metadata from public.audit_events
   where entity_id = (select id from fixture) and action = 'document.deleted'),
  '{"templateId": "musterprotokoll-einpersonen", "templateVersion": "2022-08-01"}'::jsonb,
  'document.deleted is recorded'
);

select is(
  (select count(*)::int from public.audit_events where entity_id = (select id from fixture)),
  8,
  'the history of a deleted document is kept for admins'
);

select pg_temp.sign_in_as('40000000-0000-4000-8000-00000000a003');

select is_empty(
  $$ select 1 from public.audit_events where entity_id = (select id from fixture) $$,
  'other members no longer see the history of a deleted document'
);

-- ---------------------------------------------------------------------------
-- Append-only, also for privileged roles
-- ---------------------------------------------------------------------------

reset role;

select throws_ok(
  $$ update public.audit_events set metadata = '{}'
     where tenant_id = '40000000-0000-4000-8000-0000000000aa' $$,
  '42501', 'Audit events are append-only.',
  'postgres cannot update events'
);

select throws_ok(
  $$ update public.audit_events set actor_id = '40000000-0000-4000-8000-00000000b001'
     where actor_id = '40000000-0000-4000-8000-00000000a001' $$,
  '42501', 'Audit events are append-only.',
  'postgres cannot reassign an actor'
);

select throws_ok(
  $$ delete from public.audit_events where tenant_id = '40000000-0000-4000-8000-0000000000aa' $$,
  '42501', 'Audit events are append-only.',
  'postgres cannot delete events'
);

select throws_ok(
  $$ truncate public.audit_events $$,
  '42501', 'Audit events are append-only.',
  'postgres cannot truncate events'
);

-- ---------------------------------------------------------------------------
-- Account deletion keeps the events without the person
-- ---------------------------------------------------------------------------

select set_config('request.jwt.claims', '', true);

select lives_ok(
  $$ delete from auth.users where id = '40000000-0000-4000-8000-00000000a002' $$,
  'an account can be deleted although it is an actor in the log'
);

select is(
  (select count(*)::int from public.audit_events
   where actor_id = '40000000-0000-4000-8000-00000000a002'
      or subject_user_id = '40000000-0000-4000-8000-00000000a002'),
  0,
  'the deleted account no longer appears in the log'
);

select results_eq(
  $$ select actor_id, subject_user_id, metadata from public.audit_events
     where action = 'membership.removed' $$,
  $$ values (null::uuid, null::uuid, '{"role": "editor", "reason": "account_deleted"}'::jsonb) $$,
  'the removal of the membership is recorded as an account deletion'
);

select is(
  (select count(*)::int from public.audit_events where action = 'document.created' and actor_id is null
   and tenant_id = '40000000-0000-4000-8000-0000000000aa'),
  1,
  'the events of the deleted account remain'
);

-- ---------------------------------------------------------------------------
-- Retention and firm deletion
-- ---------------------------------------------------------------------------

select throws_ok(
  $$ select private.prune_audit_events(interval '1 hour') $$,
  '22023', null,
  'retention shorter than a day is refused'
);

insert into public.audit_events (tenant_id, action, entity_type, entity_id, occurred_at)
values ('40000000-0000-4000-8000-0000000000aa', 'tenant.renamed', 'tenant',
        '40000000-0000-4000-8000-0000000000aa', now() - interval '91 days');

select is(private.prune_audit_events(interval '90 days'), 1, 'pruning removes events past the retention period');

select ok(
  exists (select 1 from public.audit_events where tenant_id = '40000000-0000-4000-8000-0000000000aa'),
  'recent events survive pruning'
);

select throws_ok(
  $$ delete from public.audit_events where tenant_id = '40000000-0000-4000-8000-0000000000aa' $$,
  '42501', 'Audit events are append-only.',
  'the pruning permission ends with the pruning call'
);

select is(
  (select audit_retention from private.app_settings),
  interval '10 years',
  'the default retention is ten years'
);

select lives_ok(
  $$ delete from public.tenants where id = '40000000-0000-4000-8000-0000000000bb' $$,
  'deleting a tenant deletes its events'
);

select is(
  (select count(*)::int from public.audit_events where tenant_id = '40000000-0000-4000-8000-0000000000bb'),
  0,
  'no events of a deleted tenant remain'
);

select * from finish();
rollback;
