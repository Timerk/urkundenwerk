-- Invitations contain a one-way hash. Only the creating request receives the
-- secret. Membership changes still flow through the existing audit triggers.
create extension if not exists pgcrypto with schema extensions;

create table public.tenant_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null check (email = lower(btrim(email)) and length(email) between 3 and 254),
  role public.tenant_role not null,
  token_hash bytea not null unique check (octet_length(token_hash) = 32),
  invited_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_at timestamptz,
  revoked_at timestamptz,
  check (accepted_at is null or revoked_at is null)
);

create index tenant_invitations_tenant_email_idx on public.tenant_invitations (tenant_id, email);
create index tenant_invitations_invited_by_idx on public.tenant_invitations (invited_by);
create index tenant_invitations_email_idx on public.tenant_invitations (email);

alter table public.tenant_invitations enable row level security;
alter table public.tenant_invitations force row level security;
revoke all on table public.tenant_invitations from public, anon, authenticated;
grant select (id, tenant_id, email, role, invited_by, created_at, expires_at, accepted_at, revoked_at)
  on public.tenant_invitations to authenticated;
create policy "admins can read invitations for their tenants"
  on public.tenant_invitations for select to authenticated
  using (private.has_tenant_role(tenant_id, '{admin}'));

drop policy "admins can add members" on public.tenant_memberships;
revoke insert on public.tenant_memberships from authenticated;

create function public.create_invitation(target_tenant_id uuid, invitee_email text, invitee_role public.tenant_role)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  address text := lower(btrim(invitee_email));
  token text;
begin
  if not private.has_tenant_role(target_tenant_id, '{admin}') then
    raise exception 'Only firm admins can invite members.' using errcode = '42501';
  end if;
  if address is null or length(address) > 254 or address !~ '^[^[:space:]@]+@[^[:space:]@]+[.][^[:space:]@]+$'
     or invitee_role is null then
    raise exception 'Enter a valid email address and role.' using errcode = '22023';
  end if;

  perform 1 from public.tenants where id = target_tenant_id for update;
  if not found or not private.has_tenant_role(target_tenant_id, '{admin}') then
    raise exception 'Only firm admins can invite members.' using errcode = '42501';
  end if;
  if not private.take_quota('tenant_invitation', caller, 10, interval '1 hour') then
    raise exception 'Invitation limit reached.' using errcode = 'PT429';
  end if;
  if exists (
    select 1 from public.tenant_invitations
    where tenant_id = target_tenant_id and email = address
      and accepted_at is null and revoked_at is null and expires_at > now()
  ) or exists (
    select 1 from public.tenant_memberships as membership
    join auth.users as account on account.id = membership.user_id
    where membership.tenant_id = target_tenant_id and lower(account.email) = address
  ) then
    raise exception 'A pending invitation or membership already exists.' using errcode = 'PT409';
  end if;

  token := encode(extensions.gen_random_bytes(32), 'hex');
  insert into public.tenant_invitations (tenant_id, email, role, token_hash, invited_by)
  values (target_tenant_id, address, invitee_role, extensions.digest(token, 'sha256'), caller);
  return token;
end;
$$;

create function public.revoke_invitation(invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  firm_id uuid;
begin
  select tenant_id into firm_id from public.tenant_invitations where id = invitation_id;
  if not private.has_tenant_role(firm_id, '{admin}') then
    raise exception 'Invitation not found.' using errcode = '42501';
  end if;
  perform 1 from public.tenants where id = firm_id for update;
  if not found or not private.has_tenant_role(firm_id, '{admin}') then
    raise exception 'Invitation not found.' using errcode = '42501';
  end if;

  update public.tenant_invitations set revoked_at = now()
  where id = invitation_id and accepted_at is null and revoked_at is null and expires_at > now();
  if not found then
    raise exception 'Invitation is no longer pending.' using errcode = 'PT409';
  end if;
end;
$$;

create function public.accept_invitation(token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  address text;
  invite public.tenant_invitations;
  hashed_token bytea;
begin
  if caller is null or token is null or token !~ '^[0-9a-f]{64}$' then
    raise exception 'Invitation unavailable for this account.' using errcode = '42501';
  end if;
  -- Use the current confirmed Auth address and coordinate with account erasure.
  select lower(btrim(email)) into address from auth.users
  where id = caller and email_confirmed_at is not null for update;
  if address is null then
    raise exception 'Invitation unavailable for this account.' using errcode = '42501';
  end if;

  hashed_token := extensions.digest(token, 'sha256');
  select * into invite from public.tenant_invitations where token_hash = hashed_token and email = address;
  perform 1 from public.tenants where id = invite.tenant_id for update;
  if not found then
    raise exception 'Invitation unavailable for this account.' using errcode = '42501';
  end if;
  update public.tenant_invitations set accepted_at = now()
  where id = invite.id and email = address
    and accepted_at is null and revoked_at is null and expires_at > now();
  if not found then
    raise exception 'Invitation unavailable for this account.' using errcode = '42501';
  end if;

  -- Consuming an invitation cannot overwrite an existing membership's role.
  insert into public.tenant_memberships (tenant_id, user_id, role)
  values (invite.tenant_id, caller, invite.role)
  on conflict (tenant_id, user_id) do nothing;
  return invite.tenant_id;
end;
$$;

revoke all on function public.create_invitation(uuid, text, public.tenant_role),
  public.revoke_invitation(uuid), public.accept_invitation(text) from public, anon, service_role;
grant execute on function public.create_invitation(uuid, text, public.tenant_role),
  public.revoke_invitation(uuid), public.accept_invitation(text) to authenticated;

-- Guard the seeded accounts by stable ID as well as address. Addresses cover
-- fresh environments where this migration precedes account provisioning.
create table private.protected_accounts (
  email text primary key,
  user_id uuid unique
);

insert into private.protected_accounts (email, user_id)
select protected.email, account.id
from (values ('anna.admin@demo.test'), ('erik.editor@demo.test'),
             ('victor.viewer@demo.test'), ('mia.multi@demo.test')) as protected(email)
left join auth.users as account on lower(account.email) = protected.email;

create function private.remember_protected_account()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  update private.protected_accounts set user_id = new.id
  where email = lower(new.email) and user_id is null;
  return null;
end;
$$;

create trigger remember_protected_account after insert or update of email on auth.users
for each row execute function private.remember_protected_account();

create function private.is_protected_account(account_id uuid, account_email text)
returns boolean language sql stable set search_path = ''
as $$
  select exists (
    select 1 from private.protected_accounts
    where user_id = account_id or email = lower(account_email)
  );
$$;

create function private.refuse_protected_account_deletion()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  if private.is_protected_account(old.id, old.email) then
    raise exception 'Shared demo accounts cannot be deleted.' using errcode = 'PT403';
  end if;
  return old;
end;
$$;

create trigger refuse_protected_account_deletion before delete on auth.users
for each row execute function private.refuse_protected_account_deletion();

revoke all on function private.remember_protected_account(),
  private.is_protected_account(uuid, text), private.refuse_protected_account_deletion()
  from public, anon, authenticated, service_role;

create function public.account_deletion_options()
returns jsonb
language sql stable security definer set search_path = ''
as $$
  select jsonb_build_object(
    'protected', private.is_protected_account(account.id, account.email),
    'soleFirms', coalesce((
      select jsonb_agg(jsonb_build_object('id', tenant.id, 'name', tenant.name) order by tenant.name, tenant.id)
      from public.tenants as tenant
      join public.tenant_memberships as mine on mine.tenant_id = tenant.id
      where mine.user_id = account.id
        and not exists (
          select 1 from public.tenant_memberships as other
          where other.tenant_id = tenant.id and other.user_id <> account.id
        )
    ), '[]')
  )
  from auth.users as account where account.id = (select auth.uid());
$$;

create function public.delete_my_account(confirm_sole_tenants uuid[] default '{}')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  address text;
  sole_tenants uuid[];
begin
  select email into address from auth.users where id = caller for update;
  if not found then
    raise exception 'Not authenticated.' using errcode = '42501';
  end if;
  if private.is_protected_account(caller, address) then
    raise exception 'Shared demo accounts cannot be deleted.' using errcode = 'PT403';
  end if;

  -- Use the same tenant locks as invitation acceptance and admin demotion.
  perform tenant.id from public.tenants as tenant
  join public.tenant_memberships as mine on mine.tenant_id = tenant.id
  where mine.user_id = caller order by tenant.id for update of tenant;

  if exists (
    select 1 from public.tenant_memberships as mine
    where mine.user_id = caller and mine.role = 'admin'
      and exists (
        select 1 from public.tenant_memberships as other
        where other.tenant_id = mine.tenant_id and other.user_id <> caller
      )
      and not exists (
        select 1 from public.tenant_memberships as other
        where other.tenant_id = mine.tenant_id and other.user_id <> caller and other.role = 'admin'
      )
  ) then
    raise exception 'Assign another admin before deleting your account.' using errcode = 'PT409';
  end if;

  select coalesce(array_agg(mine.tenant_id), '{}') into sole_tenants
  from public.tenant_memberships as mine
  where mine.user_id = caller and not exists (
    select 1 from public.tenant_memberships as other
    where other.tenant_id = mine.tenant_id and other.user_id <> caller
  );
  -- Confirm the exact firms displayed by the UI. A concurrent membership
  -- change can make a previously confirmed set stale.
  if confirm_sole_tenants is null
     or not (confirm_sole_tenants @> sole_tenants and sole_tenants @> confirm_sole_tenants) then
    raise exception 'Confirm deletion of your sole-member firms.' using errcode = 'PT412';
  end if;

  delete from public.tenants where id = any(sole_tenants);
  delete from public.tenant_invitations where email = lower(btrim(address));
  delete from auth.users where id = caller;
end;
$$;

-- Each section projects only fields about the account holder. Invitation
-- recipient addresses and audit subjects can identify other people.
create function public.export_my_account()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'profile', jsonb_build_object(
      'id', account.id, 'email', account.email, 'displayName', profile.display_name,
      'createdAt', account.created_at
    ),
    'memberships', coalesce((
      select jsonb_agg(jsonb_build_object(
        'tenantId', membership.tenant_id, 'name', tenant.name,
        'role', membership.role, 'joinedAt', membership.created_at
      ) order by membership.created_at, membership.tenant_id)
      from public.tenant_memberships as membership
      join public.tenants as tenant on tenant.id = membership.tenant_id
      where membership.user_id = account.id
    ), '[]'),
    'invitationsSent', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', invite.id, 'tenantId', invite.tenant_id, 'role', invite.role,
        'createdAt', invite.created_at, 'expiresAt', invite.expires_at,
        'acceptedAt', invite.accepted_at, 'revokedAt', invite.revoked_at
      ) order by invite.created_at, invite.id)
      from public.tenant_invitations as invite where invite.invited_by = account.id
    ), '[]'),
    'auditEvents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', event.id, 'tenantId', event.tenant_id, 'actorId', event.actor_id,
        'action', event.action, 'entityType', event.entity_type, 'entityId', event.entity_id,
        'occurredAt', event.occurred_at, 'metadata', event.metadata
      ) order by event.occurred_at, event.id)
      from public.audit_events as event where event.actor_id = account.id
    ), '[]'),
    'documentsCreated', coalesce((
      select jsonb_agg(jsonb_build_object('id', document.id, 'title', document.title)
                       order by document.created_at, document.id)
      from public.documents as document
      where document.created_by = account.id and private.is_tenant_member(document.tenant_id)
    ), '[]')
  )
  from auth.users as account
  left join public.profiles as profile on profile.user_id = account.id
  where account.id = (select auth.uid());
$$;

revoke all on function public.account_deletion_options(), public.delete_my_account(uuid[]),
  public.export_my_account() from public, anon, service_role;
grant execute on function public.account_deletion_options(), public.delete_my_account(uuid[]),
  public.export_my_account() to authenticated;
