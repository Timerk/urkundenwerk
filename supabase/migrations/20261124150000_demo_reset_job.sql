-- The hosted demo resets itself every night inside the database, so the job
-- needs no GitHub approval and no expiring access token. The function only
-- acts on the seeded demo firms (fixed IDs and slugs) and returns false
-- without changing anything where they do not exist, which is every
-- database except the hosted demo. See docs/adr/0016-database-demo-reset.md.

create extension if not exists pg_cron with schema pg_catalog;

-- The sandbox admin is a shared visitor account like the other three.
insert into private.protected_accounts (email, user_id)
select 'sara.admin@demo.test', account.id
from (select 1) as fixed
left join auth.users as account on lower(account.email) = 'sara.admin@demo.test'
on conflict (email) do nothing;

-- Visitors signed in as the sandbox admin cannot hand the firm to someone
-- else: their own admin membership in Demo-Kanzlei West stays until the
-- nightly reset. Operator and system changes (no JWT) and the cascade of a
-- deleted firm pass.
create function private.keep_sandbox_admin()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if old.tenant_id = '6b14210c-97db-41c4-80ae-0366e8f23cc3'
     and (tg_op = 'DELETE' or new.role <> 'admin')
     and (select auth.uid()) is not null
     and exists (
       select 1 from private.protected_accounts
       where user_id = old.user_id and email = 'sara.admin@demo.test'
     )
     and exists (select 1 from public.tenants where id = old.tenant_id) then
    raise exception 'The sandbox admin keeps the admin role until the nightly reset.'
      using errcode = 'PT403';
  end if;
  return coalesce(new, old);
end;
$$;

create trigger tenant_memberships_keep_sandbox_admin
  before update of role or delete on public.tenant_memberships
  for each row execute function private.keep_sandbox_admin();

revoke all on function private.keep_sandbox_admin() from public, anon, authenticated, service_role;

-- Restores the three demo firms: the sample drafts in Nord, Süd and West,
-- and in the West sandbox also the firm name, memberships and roles, and
-- invitations. It keeps quota counters, Auth users, other firms, and the
-- memberships of Nord and Süd, which only the operator administers. It
-- prunes audit events older than the demo's 90-day retention and
-- invitations 90 days after they expired.
create function private.reset_hosted_demo()
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  north constant uuid := '6b14210c-97db-41c4-80ae-0366e8f23aa1'::uuid;
  south constant uuid := '6b14210c-97db-41c4-80ae-0366e8f23bb2'::uuid;
  west constant uuid := '6b14210c-97db-41c4-80ae-0366e8f23cc3'::uuid;
  sample_ids constant uuid[] := array[
    '6b14210c-97db-41c4-80ae-0366e8f2da01',
    '6b14210c-97db-41c4-80ae-0366e8f2db02',
    '6b14210c-97db-41c4-80ae-0366e8f2dc03',
    '6b14210c-97db-41c4-80ae-0366e8f2dc04'
  ]::uuid[];
  has_west boolean;
  admin_id uuid;
  sara_id uuid;
  editor_id uuid;
  viewer_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('urkundenwerk:hosted_demo', 0));

  if not exists (select 1 from public.tenants where id = north and slug = 'hosted-demo-nord')
     or not exists (select 1 from public.tenants where id = south and slug = 'hosted-demo-sued') then
    return false;
  end if;
  has_west := exists (select 1 from public.tenants where id = west and slug = 'hosted-demo-west');

  select id into admin_id from auth.users
    where lower(email) = 'anna.admin@demo.test' and email_confirmed_at is not null;
  select id into sara_id from auth.users
    where lower(email) = 'sara.admin@demo.test' and email_confirmed_at is not null;
  select id into editor_id from auth.users
    where lower(email) = 'erik.editor@demo.test' and email_confirmed_at is not null;
  select id into viewer_id from auth.users
    where lower(email) = 'victor.viewer@demo.test' and email_confirmed_at is not null;

  -- The demo keeps its history for 90 days in every firm; a real deployment
  -- uses private.app_settings.audit_retention (docs/privacy.md).
  perform private.prune_audit_events(interval '90 days');
  delete from public.tenant_invitations where expires_at < now() - interval '90 days';

  update public.tenants as firm
  set name = expected.name
  from (values (north, 'Demo-Kanzlei Nord'), (south, 'Demo-Kanzlei Süd'), (west, 'Demo-Kanzlei West'))
    as expected (id, name)
  where firm.id = expected.id and firm.name is distinct from expected.name;

  if has_west then
    delete from public.tenant_invitations where tenant_id = west;
    if sara_id is not null and editor_id is not null and viewer_id is not null then
      -- The admin first, so that no step leaves the firm without one.
      insert into public.tenant_memberships as membership (tenant_id, user_id, role)
      values (west, sara_id, 'admin')
      on conflict (tenant_id, user_id) do update set role = excluded.role
        where membership.role is distinct from excluded.role;
      insert into public.tenant_memberships as membership (tenant_id, user_id, role)
      values (west, editor_id, 'editor'), (west, viewer_id, 'viewer')
      on conflict (tenant_id, user_id) do update set role = excluded.role
        where membership.role is distinct from excluded.role;
      delete from public.tenant_memberships
      where tenant_id = west and user_id not in (sara_id, editor_id, viewer_id);
    end if;
  end if;

  -- Users can change their own profile through the Data API.
  update public.profiles as profile
  set display_name = expected.display_name
  from auth.users as account
  join (values
      ('anna.admin@demo.test', 'Anna Admin'),
      ('sara.admin@demo.test', 'Sara Admin'),
      ('erik.editor@demo.test', 'Erik Editor'),
      ('victor.viewer@demo.test', 'Victor Viewer'),
      ('mia.multi@demo.test', 'Mia Multi')
    ) as expected (email, display_name) on lower(account.email) = expected.email
  where profile.user_id = account.id
    and profile.display_name is distinct from expected.display_name;

  delete from public.documents
  where tenant_id in (north, south, west) and id <> all (sample_ids);

  -- Untouched samples stay as they are, so the audit log only records a
  -- reset of a draft that a visitor changed.
  insert into public.documents as document
    (id, tenant_id, template_id, template_version, title, data, status, created_by)
  select sample.id, sample.tenant_id, 'musterprotokoll-einpersonen', '2022-08-01',
         sample.title, sample.data, 'draft', sample.created_by
  from (values
    (
      sample_ids[1], north, 'Nordmuster Logistik GmbH',
      $json${
        "notarisation": {
          "mode": "in_person",
          "deedNumber": "117/2026",
          "date": "2026-11-20",
          "notaryName": "Dr. Nora Musterfrau",
          "notarySeat": "Musterstadt"
        },
        "founder": {
          "kind": "natural_person",
          "salutation": "Frau",
          "firstName": "Erika",
          "lastName": "Mustermann",
          "birthDate": "1990-03-07",
          "address": { "street": "Musterweg 12", "postalCode": "12345", "city": "Musterstadt" }
        },
        "company": {
          "name": "Nordmuster Logistik GmbH",
          "seat": "Musterstadt",
          "purpose": "die Planung und Vermittlung von Logistikdienstleistungen"
        },
        "shareCapitalCents": 2500000,
        "contribution": "full",
        "managingDirector": { "kind": "founder" },
        "notaryNotes": "die Haftung bei unrichtigen Angaben zur Einlage sowie die Pflicht zur Anmeldung beim Handelsregister.",
        "filing": {
          "registerCourt": "Musterstadt",
          "businessAddress": { "street": "Musterkai 4", "postalCode": "12345", "city": "Musterstadt" },
          "paidCents": 2500000,
          "fundsAtFreeDisposal": true,
          "noDisqualification": true,
          "instructedOnDisclosure": true,
          "paymentEvidenceAttached": false
        }
      }$json$::jsonb,
      admin_id
    ),
    (
      sample_ids[2], south, 'Südmuster Design UG',
      $json${
        "notarisation": { "mode": "video" },
        "founder": { "kind": "natural_person", "salutation": "Herr", "firstName": "Jonas", "lastName": "Beispiel" },
        "company": { "name": "Südmuster Design UG (haftungsbeschränkt)", "seat": "Beispielhausen" },
        "contribution": "full",
        "managingDirector": { "kind": "founder" }
      }$json$::jsonb,
      admin_id
    ),
    (
      sample_ids[3], west, 'Westmuster Beratung GmbH',
      $json${
        "notarisation": {
          "mode": "in_person",
          "deedNumber": "204/2026",
          "date": "2026-11-18",
          "notaryName": "Dr. Nora Musterfrau",
          "notarySeat": "Musterstadt"
        },
        "founder": {
          "kind": "natural_person",
          "salutation": "Herr",
          "firstName": "Max",
          "lastName": "Beispielmann",
          "birthDate": "1985-06-14",
          "address": { "street": "Beispielallee 3", "postalCode": "54321", "city": "Beispielhausen" }
        },
        "company": {
          "name": "Westmuster Beratung GmbH",
          "seat": "Beispielhausen",
          "purpose": "die Beratung von Unternehmen in Organisationsfragen"
        },
        "shareCapitalCents": 2500000,
        "contribution": "full",
        "managingDirector": { "kind": "founder" },
        "notaryNotes": "die Haftung bei unrichtigen Angaben zur Einlage sowie die Pflicht zur Anmeldung beim Handelsregister.",
        "filing": {
          "registerCourt": "Beispielhausen",
          "businessAddress": { "street": "Beispielallee 3", "postalCode": "54321", "city": "Beispielhausen" },
          "paidCents": 2500000,
          "fundsAtFreeDisposal": true,
          "noDisqualification": true,
          "instructedOnDisclosure": true,
          "paymentEvidenceAttached": false
        }
      }$json$::jsonb,
      sara_id
    ),
    (
      sample_ids[4], west, 'Westmuster Studio UG',
      $json${
        "notarisation": { "mode": "video" },
        "founder": { "kind": "natural_person", "salutation": "Frau", "firstName": "Lea", "lastName": "Probe" },
        "company": { "name": "Westmuster Studio UG (haftungsbeschränkt)", "seat": "Beispielhausen" },
        "contribution": "full",
        "managingDirector": { "kind": "founder" }
      }$json$::jsonb,
      sara_id
    )
  ) as sample (id, tenant_id, title, data, created_by)
  where sample.tenant_id <> west or has_west
  on conflict (id) do update set
    tenant_id = excluded.tenant_id,
    template_id = excluded.template_id,
    template_version = excluded.template_version,
    title = excluded.title,
    data = excluded.data,
    status = excluded.status,
    created_by = excluded.created_by
  where (document.tenant_id, document.template_id, document.template_version, document.title,
         document.data, document.status, document.created_by)
    is distinct from
        (excluded.tenant_id, excluded.template_id, excluded.template_version, excluded.title,
         excluded.data, excluded.status, excluded.created_by);

  return true;
end;
$$;

comment on function private.reset_hosted_demo() is
  'Restores the hosted demo firms and returns true; returns false and changes nothing where they do not exist. Scheduled nightly with pg_cron.';

revoke all on function private.reset_hosted_demo() from public, anon, authenticated, service_role;

-- cron.schedule with a job name replaces an existing job of that name, so
-- re-running this statement keeps exactly one job. pg_cron uses UTC.
select cron.schedule('reset-hosted-demo', '17 2 * * *', 'select private.reset_hosted_demo()');
