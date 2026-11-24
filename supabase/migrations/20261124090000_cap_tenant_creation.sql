-- Existing tenants have no recorded creator. Track firms created from this migration onward.
create table private.tenant_creators (
  tenant_id uuid primary key references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  slot smallint not null check (slot between 1 and 3),
  unique (user_id, slot)
);
alter table private.tenant_creators enable row level security;
revoke all on private.tenant_creators from public, anon, authenticated;

create or replace function public.create_tenant(name text)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  tenant_name text := btrim(create_tenant.name);
  base_slug text;
  candidate_slug text;
  new_tenant_id uuid;
  available_slot smallint;
begin
  if caller_id is null then
    raise exception 'Not authenticated.' using errcode = 'insufficient_privilege';
  end if;

  if tenant_name is null or char_length(tenant_name) not between 2 and 120 then
    raise exception 'The firm name must have between 2 and 120 characters.'
      using errcode = 'invalid_parameter_value';
  end if;

  if exists (
    select 1 from auth.users
    where id = caller_id and raw_app_meta_data @> '{"urkundenwerk_demo": true}'
  ) then
    raise exception 'Shared demo users cannot create firms.' using errcode = 'PT403';
  end if;

  -- Serialize creations by the same user. Membership changes do not free a slot.
  perform pg_advisory_xact_lock(hashtextextended('urkundenwerk:create_tenant:' || caller_id::text, 0));
  select min(candidate) into available_slot
  from generate_series(1, 3) as candidate
  where not exists (
    select 1 from private.tenant_creators
    where user_id = caller_id and slot = candidate
  );
  if available_slot is null then
    raise exception 'A user can create at most three firms.' using errcode = 'PT409';
  end if;

  -- Transliterate German characters, then reduce to a URL-safe slug.
  base_slug := lower(tenant_name);
  base_slug := replace(replace(replace(replace(base_slug, 'ä', 'ae'), 'ö', 'oe'), 'ü', 'ue'), 'ß', 'ss');
  base_slug := btrim(regexp_replace(base_slug, '[^a-z0-9]+', '-', 'g'), '-');
  base_slug := rtrim(left(base_slug, 50), '-');
  if base_slug = '' then
    base_slug := 'firm';
  end if;

  candidate_slug := base_slug;
  loop
    begin
      insert into public.tenants (name, slug)
      values (tenant_name, candidate_slug)
      returning id into new_tenant_id;
      exit;
    exception when unique_violation then
      candidate_slug := base_slug || '-' || substr(md5(random()::text), 1, 6);
    end;
  end loop;

  insert into public.tenant_memberships (tenant_id, user_id, role)
  values (new_tenant_id, caller_id, 'admin');

  insert into private.tenant_creators (tenant_id, user_id, slot)
  values (new_tenant_id, caller_id, available_slot);

  return new_tenant_id;
end;
$$;
