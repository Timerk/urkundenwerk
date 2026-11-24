-- Hosted demo only. This statement replaces all drafts in the two seeded
-- firms atomically and prunes audit events older than the demo's 90-day
-- retention. It never resets quota counters, Auth users, or memberships.
do $$
declare
  north constant uuid := '6b14210c-97db-41c4-80ae-0366e8f23aa1';
  south constant uuid := '6b14210c-97db-41c4-80ae-0366e8f23bb2';
  admin_id uuid;
begin
  perform pg_advisory_xact_lock(hashtextextended('urkundenwerk:hosted_demo', 0));

  select id into admin_id from auth.users
    where email = 'anna.admin@demo.test' and email_confirmed_at is not null;
  if not exists (
    select 1 from public.tenants as firm
    join public.tenant_memberships as member on member.tenant_id = firm.id
    where firm.id = north and firm.slug = 'hosted-demo-nord'
      and member.user_id = admin_id and member.role = 'admin'
  ) or not exists (
    select 1 from public.tenants as firm
    join public.tenant_memberships as member on member.tenant_id = firm.id
    where firm.id = south and firm.slug = 'hosted-demo-sued'
      and member.user_id = admin_id and member.role = 'admin'
  ) then
    raise exception 'Hosted demo firms are missing or unexpected. Run the hosted seed first.';
  end if;

  -- The demo keeps its history for 90 days in every firm; a real deployment
  -- uses private.app_settings.audit_retention (docs/privacy.md).
  perform private.prune_audit_events(interval '90 days');
  -- The PR that adds invitations is deployed separately from the audit log.
  if to_regclass('public.tenant_invitations') is not null then
    delete from public.tenant_invitations where expires_at < now() - interval '90 days';
  end if;

  delete from public.documents where tenant_id in (north, south);

  insert into public.documents (id, tenant_id, template_id, template_version, title, data, created_by)
  values
    (
      '6b14210c-97db-41c4-80ae-0366e8f2da01',
      north,
      'musterprotokoll-einpersonen',
      '2022-08-01',
      'Nordmuster Logistik GmbH',
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
      }$json$,
      admin_id
    ),
    (
      '6b14210c-97db-41c4-80ae-0366e8f2db02',
      south,
      'musterprotokoll-einpersonen',
      '2022-08-01',
      'Südmuster Design UG',
      $json${
        "notarisation": { "mode": "video" },
        "founder": { "kind": "natural_person", "salutation": "Herr", "firstName": "Jonas", "lastName": "Beispiel" },
        "company": { "name": "Südmuster Design UG (haftungsbeschränkt)", "seat": "Beispielhausen" },
        "contribution": "full",
        "managingDirector": { "kind": "founder" }
      }$json$,
      admin_id
    );
end;
$$;
