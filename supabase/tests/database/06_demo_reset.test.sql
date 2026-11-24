begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

create function pg_temp.sign_in_as(user_id uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

-- The scheduled job ----------------------------------------------------------

select is(
  (select count(*)::int from cron.job where jobname = 'reset-hosted-demo'),
  1, 'exactly one nightly reset job is scheduled'
);
select is(
  (select schedule from cron.job where jobname = 'reset-hosted-demo'),
  '17 2 * * *', 'the reset runs at 02:17 UTC'
);
select is(
  (select command from cron.job where jobname = 'reset-hosted-demo'),
  'select private.reset_hosted_demo()', 'the job calls the reset function'
);
select ok(
  (select active from cron.job where jobname = 'reset-hosted-demo'),
  'the job is active'
);

-- Privileges -------------------------------------------------------------------

select ok(
  not has_function_privilege('authenticated', 'private.reset_hosted_demo()', 'execute'),
  'authenticated cannot execute the reset'
);
select ok(
  not has_function_privilege('anon', 'private.reset_hosted_demo()', 'execute'),
  'anon cannot execute the reset'
);
select ok(
  not has_function_privilege('service_role', 'private.reset_hosted_demo()', 'execute'),
  'service_role cannot execute the reset'
);
select is(
  (select prosecdef and proconfig @> array['search_path=""']
   from pg_proc where oid = 'private.reset_hosted_demo()'::regprocedure),
  true, 'the reset is security definer with an empty search_path'
);

-- No demo, no change -------------------------------------------------------------

insert into public.tenants (id, name, slug) values
  ('60000000-0000-4000-8000-0000000000aa', 'Other Firm', 'other-firm');
insert into public.documents (id, tenant_id, template_id, template_version, title)
values ('60000000-0000-4000-8000-00000000d001', '60000000-0000-4000-8000-0000000000aa',
        'musterprotokoll-einpersonen', '2022-08-01', 'Other draft');

select is(private.reset_hosted_demo(), false, 'without the demo firms the reset is a no-op');
select is(
  (select count(*)::int from public.documents where id = '60000000-0000-4000-8000-00000000d001'),
  1, 'the no-op keeps other drafts'
);

-- The hosted demo ---------------------------------------------------------------

-- The local seed may already provide these fictional accounts.
insert into auth.users (id, aud, role, email, email_confirmed_at)
select gen_random_uuid(), 'authenticated', 'authenticated', demo.email, now()
from (values ('anna.admin@demo.test'), ('sara.admin@demo.test'), ('erik.editor@demo.test'),
             ('victor.viewer@demo.test'), ('mia.multi@demo.test')) as demo (email)
where not exists (select 1 from auth.users where lower(email) = demo.email);

create temporary table demo_user as
select split_part(email, '.', 1) as name, id from auth.users
where lower(email) in ('anna.admin@demo.test', 'sara.admin@demo.test', 'erik.editor@demo.test',
                       'victor.viewer@demo.test', 'mia.multi@demo.test');
grant select on demo_user to authenticated;

insert into public.tenants (id, name, slug) values
  ('6b14210c-97db-41c4-80ae-0366e8f23aa1', 'Demo-Kanzlei Nord', 'hosted-demo-nord'),
  ('6b14210c-97db-41c4-80ae-0366e8f23bb2', 'Demo-Kanzlei Süd', 'hosted-demo-sued'),
  ('6b14210c-97db-41c4-80ae-0366e8f23cc3', 'Demo-Kanzlei West', 'hosted-demo-west');
insert into public.tenant_memberships (tenant_id, user_id, role)
select firm, (select id from demo_user where name = member), role::public.tenant_role
from (values
  ('6b14210c-97db-41c4-80ae-0366e8f23aa1'::uuid, 'anna', 'admin'),
  ('6b14210c-97db-41c4-80ae-0366e8f23bb2'::uuid, 'anna', 'admin'),
  ('6b14210c-97db-41c4-80ae-0366e8f23aa1'::uuid, 'erik', 'editor'),
  ('6b14210c-97db-41c4-80ae-0366e8f23cc3'::uuid, 'sara', 'admin'),
  ('6b14210c-97db-41c4-80ae-0366e8f23cc3'::uuid, 'erik', 'editor'),
  ('6b14210c-97db-41c4-80ae-0366e8f23cc3'::uuid, 'victor', 'viewer')
) as seeded (firm, member, role);

select is(private.reset_hosted_demo(), true, 'the reset runs once the demo firms exist');
select is(
  (select count(*)::int from public.documents
   where tenant_id in ('6b14210c-97db-41c4-80ae-0366e8f23aa1', '6b14210c-97db-41c4-80ae-0366e8f23bb2',
                       '6b14210c-97db-41c4-80ae-0366e8f23cc3')),
  4, 'the reset creates the four sample drafts'
);

-- A visitor changes the Nord sample, as on the hosted demo.
select pg_temp.sign_in_as((select id from demo_user where name = 'erik'));
update public.documents set data = jsonb_set(data, '{shareCapitalCents}', '2000000')
where id = '6b14210c-97db-41c4-80ae-0366e8f2da01';
insert into public.documents (tenant_id, template_id, template_version, title)
values ('6b14210c-97db-41c4-80ae-0366e8f23aa1', 'musterprotokoll-einpersonen', '2022-08-01', 'Scratch');

-- The sandbox admin changes the West firm.
select pg_temp.sign_in_as((select id from demo_user where name = 'sara'));
update public.tenants set name = 'Visitor Firm' where id = '6b14210c-97db-41c4-80ae-0366e8f23cc3';
update public.tenant_memberships set role = 'admin'
where tenant_id = '6b14210c-97db-41c4-80ae-0366e8f23cc3' and user_id = (select id from demo_user where name = 'erik');
delete from public.tenant_memberships
where tenant_id = '6b14210c-97db-41c4-80ae-0366e8f23cc3' and user_id = (select id from demo_user where name = 'victor');
select lives_ok(
  $$ select public.create_invitation('6b14210c-97db-41c4-80ae-0366e8f23cc3', 'mia.multi@demo.test', 'editor') $$,
  'the sandbox admin can invite into West'
);
select throws_ok(
  $$ update public.tenant_memberships set role = 'viewer'
     where tenant_id = '6b14210c-97db-41c4-80ae-0366e8f23cc3' and user_id = (select id from demo_user where name = 'sara') $$,
  'PT403', null, 'the sandbox admin cannot demote themself, even with another admin'
);
select throws_ok(
  $$ delete from public.tenant_memberships
     where tenant_id = '6b14210c-97db-41c4-80ae-0366e8f23cc3' and user_id = (select id from demo_user where name = 'sara') $$,
  'PT403', null, 'the sandbox admin cannot leave the sandbox'
);
select is(
  (select count(*)::int from public.tenant_memberships where tenant_id = '6b14210c-97db-41c4-80ae-0366e8f23aa1'),
  0, 'the sandbox admin cannot see Nord memberships'
);
select throws_ok(
  $$ select private.reset_hosted_demo() $$,
  '42501', null, 'a signed-in visitor cannot run the reset'
);
reset role;

update public.documents set title = 'Other draft, edited' where id = '60000000-0000-4000-8000-00000000d001';
select set_config('request.jwt.claims', '', true);

select is(private.reset_hosted_demo(), true, 'the nightly reset runs');
select is(
  (select (data ->> 'shareCapitalCents')::int from public.documents where id = '6b14210c-97db-41c4-80ae-0366e8f2da01'),
  2500000, 'the modified Nord sample is restored'
);
select is(
  (select count(*)::int from public.documents where title = 'Scratch'),
  0, 'scratch drafts in the demo firms are removed'
);
select is(
  (select title from public.documents where id = '60000000-0000-4000-8000-00000000d001'),
  'Other draft, edited', 'drafts of other firms stay as they are'
);
select is(
  (select name from public.tenants where id = '6b14210c-97db-41c4-80ae-0366e8f23cc3'),
  'Demo-Kanzlei West', 'the sandbox firm name is restored'
);
select results_eq(
  $$ select member.name, membership.role::text
     from public.tenant_memberships as membership join demo_user as member on member.id = membership.user_id
     where membership.tenant_id = '6b14210c-97db-41c4-80ae-0366e8f23cc3' order by 1 $$,
  $$ values ('erik', 'editor'), ('sara', 'admin'), ('victor', 'viewer') $$,
  'the sandbox memberships and roles are restored'
);
select is(
  (select count(*)::int from public.tenant_invitations where tenant_id = '6b14210c-97db-41c4-80ae-0366e8f23cc3'),
  0, 'invitations created in the sandbox are removed'
);

select ok(
  private.is_protected_account((select id from demo_user where name = 'sara'), 'sara.admin@demo.test'),
  'the sandbox admin cannot be deleted'
);

select * from finish();
rollback;
