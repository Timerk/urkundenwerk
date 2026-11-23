-- Multi-tenant foundation: law firms (tenants), memberships with roles, and
-- user profiles. Every table is protected by row-level security (RLS); see
-- docs/adr/0003-tenancy-with-row-level-security.md for the model.

-- ---------------------------------------------------------------------------
-- Secure defaults
-- ---------------------------------------------------------------------------

-- Objects that `postgres` creates in `public` later must be granted explicitly.
-- Supabase's default privileges would otherwise expose them to `anon`.
alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
alter default privileges for role postgres in schema public
  revoke execute on functions from public, anon, authenticated;

-- Helper and trigger functions live in a schema that the Data API does not
-- expose (see `[api].schemas` in supabase/config.toml).
create schema private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

-- ---------------------------------------------------------------------------
-- Tables
-- ---------------------------------------------------------------------------

create type public.tenant_role as enum ('admin', 'editor', 'viewer');

comment on type public.tenant_role is
  'admin: manages the firm and its members; editor: creates and edits documents; viewer: reads documents.';

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null
    constraint tenants_name_length check (
      name = btrim(name) and char_length(name) between 2 and 120
    ),
  slug text not null
    constraint tenants_slug_key unique
    constraint tenants_slug_format check (
      slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 63
    ),
  created_at timestamptz not null default now()
);

comment on table public.tenants is 'A law firm. All business data is scoped to exactly one tenant.';

create table public.tenant_memberships (
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.tenant_role not null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create index tenant_memberships_user_id_idx on public.tenant_memberships (user_id);

comment on table public.tenant_memberships is
  'Grants a user a role in a tenant. Membership is the only source of tenant access.';

create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  display_name text
    constraint profiles_display_name_length check (
      display_name is null or char_length(display_name) between 1 and 120
    ),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is
  'Application data about a user. Data minimisation: do not copy the email address or other personal data from auth.users here.';

-- ---------------------------------------------------------------------------
-- Authorization helpers
-- ---------------------------------------------------------------------------

-- SECURITY DEFINER lets policies on tenant_memberships consult the table
-- without recursing into their own RLS checks. Both helpers only ever answer
-- questions about the calling user.

create function private.is_tenant_member(target_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_memberships as membership
    where membership.tenant_id = target_tenant_id
      and membership.user_id = (select auth.uid())
  );
$$;

create function private.has_tenant_role(
  target_tenant_id uuid,
  allowed_roles public.tenant_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_memberships as membership
    where membership.tenant_id = target_tenant_id
      and membership.user_id = (select auth.uid())
      and membership.role = any (allowed_roles)
  );
$$;

revoke all on function private.is_tenant_member(uuid) from public, anon;
revoke all on function private.has_tenant_role(uuid, public.tenant_role[]) from public, anon;
grant execute on function private.is_tenant_member(uuid) to authenticated;
grant execute on function private.has_tenant_role(uuid, public.tenant_role[]) to authenticated;

-- ---------------------------------------------------------------------------
-- Privileges and row-level security
-- ---------------------------------------------------------------------------

-- Table privileges decide which commands and columns are reachable at all;
-- policies decide which rows. `anon` gets neither. Tenants are created only
-- through public.create_tenant and deleted only by operators.

revoke all on table public.tenants, public.tenant_memberships, public.profiles
  from anon, authenticated;

grant select, update (name) on table public.tenants to authenticated;
grant select, insert, update (role), delete on table public.tenant_memberships to authenticated;
grant select, update (display_name) on table public.profiles to authenticated;

alter table public.tenants enable row level security;
alter table public.tenants force row level security;
alter table public.tenant_memberships enable row level security;
alter table public.tenant_memberships force row level security;
alter table public.profiles enable row level security;
alter table public.profiles force row level security;

create policy "members can read their tenants"
  on public.tenants for select to authenticated
  using (private.is_tenant_member(id));

create policy "admins can update their tenants"
  on public.tenants for update to authenticated
  using (private.has_tenant_role(id, '{admin}'))
  with check (private.has_tenant_role(id, '{admin}'));

create policy "members can read memberships of their tenants"
  on public.tenant_memberships for select to authenticated
  using (private.is_tenant_member(tenant_id));

create policy "admins can add members"
  on public.tenant_memberships for insert to authenticated
  with check (private.has_tenant_role(tenant_id, '{admin}'));

create policy "admins can change member roles"
  on public.tenant_memberships for update to authenticated
  using (private.has_tenant_role(tenant_id, '{admin}'))
  with check (private.has_tenant_role(tenant_id, '{admin}'));

create policy "admins can remove members"
  on public.tenant_memberships for delete to authenticated
  using (private.has_tenant_role(tenant_id, '{admin}'));

create policy "users can read their own profile"
  on public.profiles for select to authenticated
  using (user_id = (select auth.uid()));

create policy "users can update their own profile"
  on public.profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------------
-- Invariants
-- ---------------------------------------------------------------------------

-- Every tenant keeps at least one admin. The tenant row is locked so that two
-- concurrent demotions cannot both pass the check. Cascading deletes (the
-- tenant or the user account is removed) are operator actions and pass.
create function private.ensure_tenant_keeps_an_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.role <> 'admin' or (tg_op = 'UPDATE' and new.role = 'admin') then
    return coalesce(new, old);
  end if;

  perform 1 from public.tenants where id = old.tenant_id for update;
  if not found or not exists (select 1 from auth.users where id = old.user_id) then
    return coalesce(new, old);
  end if;

  if not exists (
    select 1
    from public.tenant_memberships as membership
    where membership.tenant_id = old.tenant_id
      and membership.user_id <> old.user_id
      and membership.role = 'admin'
  ) then
    raise exception 'A tenant must keep at least one admin.'
      using errcode = 'check_violation',
        hint = 'Make another member an admin first.';
  end if;

  return coalesce(new, old);
end;
$$;

create trigger tenant_memberships_keep_an_admin
  before update of role or delete on public.tenant_memberships
  for each row execute function private.ensure_tenant_keeps_an_admin();

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger profiles_touch_updated_at
  before update on public.profiles
  for each row execute function private.touch_updated_at();

-- Every new account gets an empty profile. No data from the sign-up request is
-- copied, so user-controlled metadata never reaches application tables.
create function private.create_profile_for_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function private.create_profile_for_new_user();

revoke all on function private.ensure_tenant_keeps_an_admin() from public, anon, authenticated;
revoke all on function private.touch_updated_at() from public, anon, authenticated;
revoke all on function private.create_profile_for_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: create a tenant for the calling user
-- ---------------------------------------------------------------------------

create function public.create_tenant(name text)
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
begin
  if caller_id is null then
    raise exception 'Not authenticated.' using errcode = 'insufficient_privilege';
  end if;

  if tenant_name is null or char_length(tenant_name) not between 2 and 120 then
    raise exception 'The firm name must have between 2 and 120 characters.'
      using errcode = 'invalid_parameter_value';
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

  return new_tenant_id;
end;
$$;

comment on function public.create_tenant(text) is
  'Creates a tenant and makes the caller its admin. Returns the new tenant id.';

revoke all on function public.create_tenant(text) from public, anon;
grant execute on function public.create_tenant(text) to authenticated;
