-- One operator-managed settings row; paid calls remain off until configured.
create table private.app_settings (
  singleton boolean primary key default true check (singleton),
  ai_daily_request_limit integer not null default 0 check (ai_daily_request_limit >= 0)
);
alter table private.app_settings enable row level security;
revoke all on private.app_settings from public, anon, authenticated, service_role;
insert into private.app_settings default values;

-- Keep at most one counter per user and operation, plus one for the whole deployment.
create table private.request_quotas (
  kind text not null,
  user_id uuid references auth.users (id) on delete cascade,
  expires_at timestamptz not null,
  used integer not null check (used > 0),
  unique nulls not distinct (kind, user_id)
);
create index request_quotas_user_id_idx on private.request_quotas (user_id);
alter table private.request_quotas enable row level security;
revoke all on private.request_quotas from public, anon, authenticated, service_role;

create function private.take_quota(
  quota_kind text, caller uuid, request_limit integer, window_length interval
)
returns boolean
language plpgsql
set search_path = ''
as $$
declare
  requested_at timestamptz := statement_timestamp();
  new_expiry timestamptz := case when caller is null
    then (date_trunc('day', requested_at at time zone 'UTC') + interval '1 day') at time zone 'UTC'
    else requested_at + window_length
  end;
begin
  if request_limit <= 0 or request_limit is null then
    return false;
  end if;

  -- The unique index serializes increments, including simultaneous first requests.
  insert into private.request_quotas as quota (kind, user_id, expires_at, used)
  values (quota_kind, caller, new_expiry, 1)
  on conflict (kind, user_id) do update
  set used = case when quota.expires_at <= requested_at then 1 else quota.used + 1 end,
      expires_at = case when quota.expires_at <= requested_at then excluded.expires_at else quota.expires_at end
  where quota.expires_at <= requested_at or quota.used < request_limit;

  return found;
end;
$$;
revoke all on function private.take_quota(text, uuid, integer, interval)
  from public, anon, authenticated, service_role;

create function public.consume_ai_request(kind text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  user_limit integer;
  user_window interval;
  daily_limit integer;
begin
  if caller is null then
    raise exception 'Not authenticated.' using errcode = '42501';
  end if;

  case kind
    when 'explain' then user_limit := 10; user_window := interval '1 minute';
    when 'import' then user_limit := 6; user_window := interval '10 minutes';
    else raise exception 'Unknown quota kind.' using errcode = '22023';
  end case;

  -- This exception block rolls back the user reservation when the global
  -- counter refuses the attempt. Acquire locks in user-then-global order.
  begin
    if not private.take_quota(kind, caller, user_limit, user_window) then
      return 'user_limited';
    end if;

    select ai_daily_request_limit into daily_limit from private.app_settings;
    if not private.take_quota('ai', null, daily_limit, null) then
      raise exception using errcode = 'UW001', message = 'Daily AI budget exhausted.';
    end if;
  exception when sqlstate 'UW001' then
    return 'budget_exhausted';
  end;

  return 'allowed';
end;
$$;
revoke all on function public.consume_ai_request(text) from public, anon, service_role;
grant execute on function public.consume_ai_request(text) to authenticated;
