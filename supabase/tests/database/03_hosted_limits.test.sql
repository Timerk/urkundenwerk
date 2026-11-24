begin;
create extension if not exists pgtap with schema extensions;
select plan(32);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a002', true);
set local role authenticated;

select lives_ok($$select public.create_tenant('First firm')$$, 'can create a first firm');
select lives_ok($$select public.create_tenant('Second firm')$$, 'can create a second firm');
select lives_ok($$select public.create_tenant('Third firm')$$, 'can create a third firm');
select throws_ok(
  $$select public.create_tenant('Fourth firm')$$,
  'PT409', 'A user can create at most three firms.', 'cannot create a fourth firm'
);
select is(public.consume_ai_request('explain'), 'budget_exhausted', 'the default budget blocks paid requests');
select throws_ok($$select public.consume_ai_request('ai')$$, '22023', null, 'cannot choose the global counter');
select throws_ok($$select public.consume_ai_request('explain', 100)$$, '42883', null, 'the caller cannot supply a limit');
select throws_ok($$select * from private.request_quotas where kind in ('ai', 'extract', 'explain')$$, '42501', null, 'users cannot read counters');
select throws_ok($$delete from private.request_quotas$$, '42501', null, 'users cannot change counters');
select throws_ok($$select * from private.app_settings$$, '42501', null, 'users cannot read settings directly');
select throws_ok(
  $$update private.app_settings set ai_daily_request_limit = 100$$, '42501', null,
  'users cannot change the budget'
);

reset role;
select is_empty($$select * from private.request_quotas where kind in ('ai', 'extract', 'explain')$$, 'a denied global reservation creates no user counter');
update private.app_settings set ai_daily_request_limit = 100;

set local role authenticated;
select is(
  (select count(*) from generate_series(1, 10) where public.consume_ai_request('explain') = 'allowed'),
  10::bigint, 'can use ten explanation slots'
);
select is(public.consume_ai_request('explain'), 'user_limited', 'the next explanation is denied');
select is(public.consume_ai_request('import'), 'allowed', 'imports use an independent quota');
select is(
  (select count(*) from generate_series(1, 6) where public.consume_ai_request('import') = 'allowed'),
  5::bigint, 'only five import slots remain'
);
select is(public.consume_ai_request('import'), 'user_limited', 'the seventh import is denied');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a003', true);
select lives_ok($$select public.create_tenant('Independent firm')$$, 'a second user has their own creation cap');
select is(public.consume_ai_request('explain'), 'allowed', 'a second user has their own explanation slots');

reset role;
select is((select used from private.request_quotas where kind = 'ai'), 17, 'only allowed attempts consume the global budget');
select is(
  (select expires_at from private.request_quotas where kind = 'ai'),
  (date_trunc('day', statement_timestamp() at time zone 'UTC') + interval '1 day') at time zone 'UTC',
  'global budget expires at midnight UTC'
);
update private.app_settings set ai_daily_request_limit = 18;

set local role authenticated;
select is(public.consume_ai_request('import'), 'allowed', 'a different user and operation take the final global slot');
select is(public.consume_ai_request('explain'), 'budget_exhausted', 'a request with user quota remaining is denied');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a002', true);
select is(public.consume_ai_request('explain'), 'user_limited', 'the per-user check runs before the global check');

reset role;
select is(
  (select used from private.request_quotas
   where kind = 'explain' and user_id = '00000000-0000-4000-8000-00000000a003'),
  1, 'a denied global reservation rolls back an existing user counter'
);
select is((select used from private.request_quotas where kind = 'ai'), 18, 'denied attempts leave the global counter unchanged');
update private.request_quotas set expires_at = statement_timestamp() - interval '1 second';
update auth.users set raw_app_meta_data = raw_app_meta_data || '{"urkundenwerk_demo": true}'
where id = '00000000-0000-4000-8000-00000000a003';

set local role authenticated;
select is(public.consume_ai_request('explain'), 'allowed', 'expired user and global windows start fresh');
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-00000000a003', true);
select throws_ok($$select public.create_tenant('Shared firm')$$, 'PT403', null, 'shared demo users cannot create firms');

reset role;
set local role anon;
select throws_ok($$select public.consume_ai_request('explain')$$, '42501', null, 'anonymous users cannot consume quotas');
select throws_ok($$select * from private.request_quotas where kind in ('ai', 'extract', 'explain')$$, '42501', null, 'anonymous users cannot read counters');
select throws_ok($$select * from private.app_settings$$, '42501', null, 'anonymous users cannot read settings');

reset role;
set local role service_role;
select throws_ok($$select public.consume_ai_request('explain')$$, '42501', null, 'the service role has no RPC grant');

select * from finish();
rollback;
