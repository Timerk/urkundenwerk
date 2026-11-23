-- Catalog-wide checks. They cover tables and functions added by later
-- migrations without changes to this file.
begin;
create extension if not exists pgtap with schema extensions;

select plan(8);

select is(
  array(
    select c.relname::text
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relrowsecurity
    order by 1
  ),
  array[]::text[],
  'every table in public has row-level security enabled'
);

select is(
  array(
    select c.relname::text
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not c.relforcerowsecurity
    order by 1
  ),
  array[]::text[],
  'every table in public forces row-level security for its owner'
);

select is(
  array(
    select c.relname::text
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relkind in ('r', 'p')
      and not exists (
        select 1 from pg_catalog.pg_policy as p where p.polrelid = c.oid
      )
    order by 1
  ),
  array[]::text[],
  'every table in public has at least one policy'
);

select is(
  array(
    select format('%s: %s', tablename, policyname)
    from pg_catalog.pg_policies
    where schemaname = 'public'
      and roles <> array['authenticated']::name[]
    order by 1
  ),
  array[]::text[],
  'every policy in public applies to the authenticated role only'
);

select is(
  array(
    select format('%s.%s', n.nspname, c.relname)
    from pg_catalog.pg_class as c
    join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
    where n.nspname in ('public', 'private')
      and c.relkind in ('r', 'p', 'v', 'm')
      and (
        has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
        or has_any_column_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE')
      )
    order by 1
  ),
  array[]::text[],
  'anon has no privileges on any table or view'
);

select is(
  array(
    select p.oid::regprocedure::text
    from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and has_function_privilege('anon', p.oid, 'EXECUTE')
    order by 1
  ),
  array[]::text[],
  'anon cannot execute any function in public or private'
);

select is(
  array(
    select p.oid::regprocedure::text
    from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prosecdef
      and not coalesce('search_path=""' = any (p.proconfig), false)
    order by 1
  ),
  array[]::text[],
  'every security definer function pins an empty search_path'
);

select is(
  array(
    select p.oid::regprocedure::text
    from pg_catalog.pg_proc as p
    join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.prorettype = 'trigger'::regtype
      and has_function_privilege('authenticated', p.oid, 'EXECUTE')
    order by 1
  ),
  array[]::text[],
  'authenticated cannot call trigger functions directly'
);

select * from finish();
rollback;
