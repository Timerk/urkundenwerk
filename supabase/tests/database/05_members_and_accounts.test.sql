begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

create function pg_temp.sign_in_as(user_id uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', user_id, 'role', 'authenticated')::text, true);
  set local role authenticated;
end;
$$;

insert into auth.users (id, aud, role, email, email_confirmed_at)
values
  ('50000000-0000-4000-8000-00000000a001', 'authenticated', 'authenticated', 'admin@members.test', now()),
  ('50000000-0000-4000-8000-00000000a002', 'authenticated', 'authenticated', 'invitee@members.test', now()),
  ('50000000-0000-4000-8000-00000000a003', 'authenticated', 'authenticated', 'outsider@members.test', now()),
  ('50000000-0000-4000-8000-00000000b001', 'authenticated', 'authenticated', 'sole@members.test', now());

insert into public.tenants (id, name, slug) values
  ('50000000-0000-4000-8000-0000000000aa', 'Members A', 'members-a'),
  ('50000000-0000-4000-8000-0000000000bb', 'Members B', 'members-b');
insert into public.tenant_memberships (tenant_id, user_id, role) values
  ('50000000-0000-4000-8000-0000000000aa', '50000000-0000-4000-8000-00000000a001', 'admin'),
  ('50000000-0000-4000-8000-0000000000bb', '50000000-0000-4000-8000-00000000b001', 'admin');

create temporary table tokens (kind text primary key, token text);
grant select, insert on tokens to authenticated;

select pg_temp.sign_in_as('50000000-0000-4000-8000-00000000a001');

select throws_ok(
  $$ insert into public.tenant_memberships (tenant_id, user_id, role)
     values ('50000000-0000-4000-8000-0000000000aa','50000000-0000-4000-8000-00000000a002','viewer') $$,
  '42501', null, 'even a firm admin cannot insert a membership directly'
);
select throws_ok(
  $$ select public.create_invitation('50000000-0000-4000-8000-0000000000bb', 'invitee@members.test', 'editor') $$,
  '42501', null, 'admin of A cannot invite into firm B'
);
select lives_ok(
  $$ insert into tokens values ('active', public.create_invitation(
      '50000000-0000-4000-8000-0000000000aa', '  Invitee@MEMBERS.test  ', 'editor')) $$,
  'an admin receives an invitation token'
);
select matches((select token from tokens where kind = 'active'), '^[0-9a-f]{64}$', 'invitation token is an opaque secret');
select is(
  (select email from public.tenant_invitations where tenant_id = '50000000-0000-4000-8000-0000000000aa'),
  'invitee@members.test', 'invitation addresses are normalized'
);
select is(
  (select expires_at - created_at from public.tenant_invitations where tenant_id = '50000000-0000-4000-8000-0000000000aa'),
  interval '7 days', 'invitations are valid for seven days'
);
select throws_ok(
  $$ select token_hash from public.tenant_invitations $$,
  '42501', null, 'even an admin cannot read invitation hashes through the API'
);
select throws_ok(
  $$ select public.create_invitation('50000000-0000-4000-8000-0000000000aa', 'invitee@members.test', 'viewer') $$,
  'PT409', null, 'duplicate pending invitations are refused'
);
insert into tokens values
  ('expired', public.create_invitation('50000000-0000-4000-8000-0000000000aa', 'outsider@members.test', 'editor')),
  ('revoked', public.create_invitation('50000000-0000-4000-8000-0000000000aa', 'sole@members.test', 'editor'));

select lives_ok(
  $$ select public.revoke_invitation(
       (select id from public.tenant_invitations where tenant_id = '50000000-0000-4000-8000-0000000000aa'
        and email = 'sole@members.test')) $$,
  'an admin can revoke a pending invitation'
);

reset role;
select ok(
  (select token_hash = extensions.digest((select token from tokens where kind = 'active'), 'sha256')
   from public.tenant_invitations where email = 'invitee@members.test'),
  'the stored secret is a SHA-256 hash'
);
update public.tenant_invitations set expires_at = now() - interval '1 second' where email = 'outsider@members.test';

select pg_temp.sign_in_as('50000000-0000-4000-8000-00000000a003');
select is_empty($$ select id from public.tenant_invitations $$, 'an outsider cannot list invitations');
select throws_ok(
  $$ select public.accept_invitation((select token from tokens where kind = 'active')) $$,
  '42501', null, 'a different confirmed email cannot accept'
);
select throws_ok(
  $$ select public.accept_invitation((select token from tokens where kind = 'expired')) $$,
  '42501', null, 'an expired invitation cannot be accepted'
);

select pg_temp.sign_in_as('50000000-0000-4000-8000-00000000b001');
select is_empty($$ select id from public.tenant_invitations $$, 'admin of B cannot list invitations of A');
select throws_ok(
  $$ select public.accept_invitation((select token from tokens where kind = 'revoked')) $$,
  '42501', null, 'a revoked invitation cannot be accepted'
);

select pg_temp.sign_in_as('50000000-0000-4000-8000-00000000a002');
select is(
  public.accept_invitation((select token from tokens where kind = 'active')),
  '50000000-0000-4000-8000-0000000000aa'::uuid, 'the intended account accepts the invitation'
);
select is(
  (select role::text from public.tenant_memberships
   where tenant_id = '50000000-0000-4000-8000-0000000000aa' and user_id = auth.uid()),
  'editor', 'acceptance creates the intended membership'
);
select throws_ok(
  $$ select public.accept_invitation((select token from tokens where kind = 'active')) $$,
  '42501', null, 'a token cannot be reused'
);
select is_empty($$ select id from public.tenant_invitations $$, 'an editor cannot list invitations');
select throws_ok(
  $$ select public.create_invitation('50000000-0000-4000-8000-0000000000aa', 'outsider@members.test', 'viewer') $$,
  '42501', null, 'an editor cannot create invitations'
);
insert into public.documents (tenant_id, template_id, template_version, title)
values ('50000000-0000-4000-8000-0000000000aa', 'musterprotokoll-einpersonen', '2022-08-01', 'Firm draft');

select pg_temp.sign_in_as('50000000-0000-4000-8000-00000000a001');
select is(jsonb_array_length(public.export_my_account()->'invitationsSent'), 3, 'export includes invitations the caller sent');
select ok(public.export_my_account()::text not like '%invitee@members.test%', 'export excludes the recipient address');
select is(jsonb_array_length(public.export_my_account()->'documentsCreated'), 0, 'export excludes another member’s draft');
select throws_ok(
  $$ select public.delete_my_account() $$,
  'PT409', null, 'the last admin cannot delete their account when the firm has other members'
);

select pg_temp.sign_in_as('50000000-0000-4000-8000-00000000a002');
select lives_ok($$ select public.delete_my_account() $$, 'an ordinary member can delete their account');
reset role;
select ok(
  not exists (select 1 from auth.users where id = '50000000-0000-4000-8000-00000000a002')
  and exists (select 1 from public.documents where title = 'Firm draft' and created_by is null)
  and not exists (select 1 from public.audit_events where actor_id = '50000000-0000-4000-8000-00000000a002')
  and not exists (select 1 from public.tenant_invitations where email = 'invitee@members.test'),
  'deletion preserves the firm draft and removes account references, including invitations addressed to it'
);

select pg_temp.sign_in_as('50000000-0000-4000-8000-00000000b001');
select throws_ok(
  $$ select public.delete_my_account() $$,
  'PT412', null, 'sole-member firm deletion requires explicit confirmation'
);
select throws_ok(
  $$ select public.delete_my_account(array['50000000-0000-4000-8000-0000000000aa'::uuid]) $$,
  'PT412', null, 'confirmation must identify the actual sole-member firm'
);
select lives_ok(
  $$ select public.delete_my_account(array['50000000-0000-4000-8000-0000000000bb'::uuid]) $$,
  'confirmation of the exact firm allows its deletion'
);
reset role;
select is_empty(
  $$ select id from public.tenants where id = '50000000-0000-4000-8000-0000000000bb' $$,
  'the sole-member firm was deleted'
);

-- Check both the seeded IDs and their addresses as known to the hosted demo.
select pg_temp.sign_in_as((select id from auth.users where email = 'anna.admin@demo.test'));
select throws_ok($$ select public.delete_my_account() $$, 'PT403', null, 'a shared demo account cannot be deleted');

select * from finish();
rollback;
