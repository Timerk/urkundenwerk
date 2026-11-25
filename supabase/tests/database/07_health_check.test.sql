begin;
create extension if not exists pgtap with schema extensions;

select plan(6);

select has_function('public', 'health_check', array[]::name[]);
select ok(
  (select not prosecdef from pg_catalog.pg_proc where oid = 'public.health_check()'::regprocedure),
  'health_check runs with caller privileges'
);
select ok(
  not exists (
    select 1 from pg_catalog.pg_proc as p
    cross join lateral aclexplode(coalesce(p.proacl, acldefault('f', p.proowner))) as acl
    where p.oid = 'public.health_check()'::regprocedure
      and acl.grantee = 0
      and acl.privilege_type = 'EXECUTE'
  ),
  'PUBLIC has no execute grant'
);
select ok(
  not has_function_privilege('service_role', 'public.health_check()', 'EXECUTE'),
  'service_role has no execute grant'
);
select ok(
  has_function_privilege('authenticated', 'public.health_check()', 'EXECUTE'),
  'authenticated has an execute grant'
);

set local role anon;
select is(public.health_check(), true, 'anon can execute health_check and gets true');
reset role;

select * from finish();
rollback;
