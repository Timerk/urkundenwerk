-- Append-only audit log. Triggers on tenants, memberships, and documents
-- write every change, and one narrow RPC records exports and imports. Clients
-- can read events through RLS but never write, change, or delete them.
-- Metadata names what changed (field paths, roles, formats, versions) and
-- never the values. See docs/adr/0014-audit-log.md.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  -- Null for operator and system changes, and after the actor's account is
  -- deleted. The log then keeps the event without the person.
  actor_id uuid references auth.users (id) on delete set null,
  action text not null
    constraint audit_events_action_known check (
      action in (
        'tenant.renamed',
        'membership.added',
        'membership.role_changed',
        'membership.removed',
        'document.created',
        'document.updated',
        'document.deleted',
        'document.exported',
        'document.imported'
      )
    ),
  entity_type text not null
    constraint audit_events_entity_type_known check (
      entity_type in ('tenant', 'membership', 'document')
    ),
  -- The document or tenant. Documents have no foreign key, so their history
  -- outlives them. Membership events point at a person through
  -- subject_user_id instead, which is cleared when that account is deleted.
  entity_id uuid,
  subject_user_id uuid references auth.users (id) on delete set null,
  -- The clock time, not the transaction start, so events of one transaction
  -- keep their order.
  occurred_at timestamptz not null default clock_timestamp(),
  metadata jsonb not null default '{}'
    constraint audit_events_metadata_object check (
      jsonb_typeof(metadata) = 'object' and octet_length(metadata::text) <= 8192
    ),
  constraint audit_events_entity_matches_action check (
    split_part(action, '.', 1) = entity_type
  ),
  constraint audit_events_entity_reference check (
    case entity_type
      when 'document' then entity_id is not null and subject_user_id is null
      when 'tenant' then entity_id = tenant_id and subject_user_id is null
      else entity_id is null
    end
  )
);

create index audit_events_tenant_id_occurred_at_idx
  on public.audit_events (tenant_id, occurred_at desc, id desc);
create index audit_events_entity_id_occurred_at_idx
  on public.audit_events (entity_id, occurred_at desc, id desc)
  where entity_id is not null;
create index audit_events_actor_id_idx on public.audit_events (actor_id);
create index audit_events_subject_user_id_idx on public.audit_events (subject_user_id);

comment on table public.audit_events is
  'Append-only history of changes per tenant. Written by triggers and record_document_event only. Metadata records field paths, roles, formats, and versions, never personal values or document text.';

-- ---------------------------------------------------------------------------
-- Privileges and row-level security
-- ---------------------------------------------------------------------------

revoke all on table public.audit_events from anon, authenticated;
grant select on table public.audit_events to authenticated;

alter table public.audit_events enable row level security;
alter table public.audit_events force row level security;

-- Admins oversee the whole firm. Editors and viewers see the history of the
-- documents they can read, which is what the activity panel shows them; the
-- membership and firm history, and the history of deleted documents, stay
-- with the admins.
create policy "admins read all events of their tenants"
  on public.audit_events for select to authenticated
  using (private.has_tenant_role(tenant_id, '{admin}'));

create policy "members read events of documents they can read"
  on public.audit_events for select to authenticated
  using (
    entity_type = 'document'
    and private.is_tenant_member(tenant_id)
    and exists (
      select 1 from public.documents as document
      where document.id = audit_events.entity_id
        and document.tenant_id = audit_events.tenant_id
    )
  );

-- ---------------------------------------------------------------------------
-- Append-only enforcement
-- ---------------------------------------------------------------------------

-- Grants already keep clients out. This trigger also stops the table owner
-- and other privileged roles, so a mistaken migration or console session
-- cannot rewrite history. Three changes pass:
--   * clearing actor_id or subject_user_id, which the foreign keys do when
--     an account is deleted;
--   * deleting the events of a tenant that no longer exists (the cascade
--     when an operator or the last member deletes a firm);
--   * private.prune_audit_events, the documented retention job.
-- A superuser can still disable triggers; this guards against mistakes and
-- the application roles, not against the database operator.
create function private.guard_audit_events()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if pg_trigger_depth() > 1
       and (to_jsonb(new) - 'actor_id' - 'subject_user_id')
         = (to_jsonb(old) - 'actor_id' - 'subject_user_id')
       and (new.actor_id is not distinct from old.actor_id or
            (new.actor_id is null and not exists (select 1 from auth.users where id = old.actor_id)))
       and (new.subject_user_id is not distinct from old.subject_user_id or
            (new.subject_user_id is null and not exists (select 1 from auth.users where id = old.subject_user_id))) then
      return new;
    end if;
  elsif tg_op = 'DELETE' then
    if current_setting('urkundenwerk.audit_prune_before', true) is not null
       and current_setting('urkundenwerk.audit_prune_before', true) <> ''
       and old.occurred_at < current_setting('urkundenwerk.audit_prune_before', true)::timestamptz then
      return old;
    end if;
    if not exists (select 1 from public.tenants where id = old.tenant_id) then
      return old;
    end if;
  end if;

  raise exception 'Audit events are append-only.'
    using errcode = 'insufficient_privilege',
      hint = 'Use private.prune_audit_events for retention.';
end;
$$;

create trigger audit_events_append_only
  before update or delete on public.audit_events
  for each row execute function private.guard_audit_events();

create function private.refuse_audit_truncate()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Audit events are append-only.' using errcode = 'insufficient_privilege';
end;
$$;

create trigger audit_events_no_truncate
  before truncate on public.audit_events
  for each statement execute function private.refuse_audit_truncate();

-- ---------------------------------------------------------------------------
-- Retention
-- ---------------------------------------------------------------------------

-- The retention period is a deployment decision (docs/privacy.md). The
-- default is ten years. The hosted demo prunes after 90 days.
alter table private.app_settings
  add column audit_retention interval not null default interval '10 years'
    constraint app_settings_audit_retention_positive check (audit_retention >= interval '1 day'),
  add column audit_import_models text[] not null default '{gpt-6.1-terra,claude-opus-5-5,fake-model}';

create function private.prune_audit_events(older_than interval default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  retention interval := coalesce(
    older_than,
    (select audit_retention from private.app_settings)
  );
  cutoff timestamptz;
  removed integer;
begin
  if retention is null or retention < interval '1 day' then
    raise exception 'The retention period must be at least one day.'
      using errcode = 'invalid_parameter_value';
  end if;
  cutoff := now() - retention;

  perform set_config('urkundenwerk.audit_prune_before', cutoff::text, true);
  delete from public.audit_events where occurred_at < cutoff;
  get diagnostics removed = row_count;
  perform set_config('urkundenwerk.audit_prune_before', '', true);
  return removed;
end;
$$;

comment on function private.prune_audit_events(interval) is
  'Deletes audit events older than the given interval, or than private.app_settings.audit_retention. Operator only.';

revoke all on function private.guard_audit_events() from public, anon, authenticated;
revoke all on function private.refuse_audit_truncate() from public, anon, authenticated;
revoke all on function private.prune_audit_events(interval) from public, anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

-- Draft keys are user-controlled through the Data API. Only known field
-- paths can reach the log, even for a malformed draft.
create function private.document_changed_paths(old_value jsonb, new_value jsonb)
returns setof text
language sql
immutable
set search_path = ''
as $$
  select path from (values
      ('notarisation.mode'),
      ('notarisation.deedNumber'),
      ('notarisation.date'),
      ('notarisation.notaryName'),
      ('notarisation.notarySeat'),
      ('founder.kind'),
      ('founder.salutation'),
      ('founder.firstName'),
      ('founder.lastName'),
      ('founder.birthDate'),
      ('founder.address.street'),
      ('founder.address.postalCode'),
      ('founder.address.city'),
      ('founder.name'),
      ('founder.registerCourt'),
      ('founder.registerNumber'),
      ('founder.seat'),
      ('founder.identificationDetails'),
      ('company.name'),
      ('company.seat'),
      ('company.purpose'),
      ('shareCapitalCents'),
      ('contribution'),
      ('managingDirector.kind'),
      ('managingDirector.salutation'),
      ('managingDirector.firstName'),
      ('managingDirector.lastName'),
      ('managingDirector.birthDate'),
      ('managingDirector.residence'),
      ('notaryNotes'),
      ('filing.registerCourt'),
      ('filing.businessAddress.street'),
      ('filing.businessAddress.postalCode'),
      ('filing.businessAddress.city'),
      ('filing.paidCents'),
      ('filing.fundsAtFreeDisposal'),
      ('filing.noDisqualification'),
      ('filing.instructedOnDisclosure'),
      ('filing.paymentEvidenceAttached')
  ) as supported(path)
  where old_value #> string_to_array(path, '.') is distinct from
        new_value #> string_to_array(path, '.');
$$;

revoke all on function private.document_changed_paths(jsonb, jsonb) from public, anon, authenticated;

-- The tuple is client-supplied at draft creation. Log only registered
-- templates and versions.
create function private.audit_template(template_id text, template_version text)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select case
    when template_id = 'musterprotokoll-einpersonen' and template_version = '2022-08-01'
      then jsonb_build_object('templateId', template_id, 'templateVersion', template_version)
    else '{}'::jsonb end;
$$;

revoke all on function private.audit_template(text, text) from public, anon, authenticated;

-- The signed-in user, if their account still exists. During the cascade of
-- an account deletion the row is already gone, and the event is then
-- recorded without an actor.
create function private.audit_actor()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select id from auth.users where id = (select auth.uid());
$$;

revoke all on function private.audit_actor() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create function private.audit_tenant_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.name is distinct from old.name then
    insert into public.audit_events (tenant_id, actor_id, action, entity_type, entity_id, metadata)
    values (new.id, private.audit_actor(), 'tenant.renamed', 'tenant', new.id,
            jsonb_build_object('fields', jsonb_build_array('name')));
  end if;
  return null;
end;
$$;

create trigger tenants_audit
  after update of name on public.tenants
  for each row execute function private.audit_tenant_change();

create function private.audit_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  member uuid;
  details jsonb;
begin
  if tg_op = 'INSERT' then
    insert into public.audit_events (tenant_id, actor_id, action, entity_type, subject_user_id, metadata)
    values (new.tenant_id, private.audit_actor(), 'membership.added', 'membership', new.user_id,
            jsonb_build_object('role', new.role));
    return null;
  end if;

  if tg_op = 'UPDATE' then
    if new.role is distinct from old.role then
      insert into public.audit_events (tenant_id, actor_id, action, entity_type, subject_user_id, metadata)
      values (new.tenant_id, private.audit_actor(), 'membership.role_changed', 'membership', new.user_id,
              jsonb_build_object('from', old.role, 'to', new.role));
    end if;
    return null;
  end if;

  -- The firm itself is being deleted: its events go with it.
  if not exists (select 1 from public.tenants where id = old.tenant_id) then
    return null;
  end if;

  select id into member from auth.users where id = old.user_id;
  details := jsonb_build_object('role', old.role);
  if member is null then
    details := details || '{"reason": "account_deleted"}';
  end if;
  insert into public.audit_events (tenant_id, actor_id, action, entity_type, subject_user_id, metadata)
  values (old.tenant_id, private.audit_actor(), 'membership.removed', 'membership', member, details);
  return null;
end;
$$;

create trigger tenant_memberships_audit
  after insert or update or delete on public.tenant_memberships
  for each row execute function private.audit_membership_change();

-- Autosave writes a draft every few seconds while someone types. A save
-- whose changed paths the same person already recorded for this document
-- in the last ten minutes adds nothing to the history and is skipped. A
-- different field, person, or a later save starts a new event.
create function private.audit_document_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := private.audit_actor();
  fields text[];
  details jsonb := '{}';
  latest public.audit_events;
begin
  if tg_op = 'INSERT' then
    insert into public.audit_events (tenant_id, actor_id, action, entity_type, entity_id, metadata)
    values (new.tenant_id, actor, 'document.created', 'document', new.id,
            private.audit_template(new.template_id, new.template_version) || jsonb_build_object('status', new.status));
    return null;
  end if;

  if tg_op = 'DELETE' then
    if not exists (select 1 from public.tenants where id = old.tenant_id) then
      return null;
    end if;
    insert into public.audit_events (tenant_id, actor_id, action, entity_type, entity_id, metadata)
    values (old.tenant_id, actor, 'document.deleted', 'document', old.id,
            private.audit_template(old.template_id, old.template_version));
    return null;
  end if;

  select coalesce(array_agg(path order by path), '{}') into fields
  from (
    select path from private.document_changed_paths(old.data, new.data) as path
    union
    select 'title' where new.title is distinct from old.title
  ) as changed;
  if new.status is distinct from old.status then
    details := jsonb_build_object('status', jsonb_build_object('from', old.status, 'to', new.status));
  end if;
  if cardinality(fields) = 0 and details = '{}' then
    return null;
  end if;

  if details = '{}' then
    select * into latest from public.audit_events
    where entity_id = new.id
    order by occurred_at desc, id desc
    limit 1;
    if latest.action = 'document.updated'
       and latest.actor_id is not distinct from actor
       and latest.occurred_at > now() - interval '10 minutes'
       and latest.metadata ? 'fields'
       and array(select jsonb_array_elements_text(latest.metadata -> 'fields')) @> fields then
      return null;
    end if;
  end if;

  insert into public.audit_events (tenant_id, actor_id, action, entity_type, entity_id, metadata)
  values (new.tenant_id, actor, 'document.updated', 'document', new.id,
          details || jsonb_build_object('fields', to_jsonb(fields)));
  return null;
end;
$$;

create trigger documents_audit
  after insert or update or delete on public.documents
  for each row execute function private.audit_document_change();

revoke all on function private.audit_tenant_change() from public, anon, authenticated;
revoke all on function private.audit_membership_change() from public, anon, authenticated;
revoke all on function private.audit_document_change() from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- RPC: explicit document events
-- ---------------------------------------------------------------------------

-- Exports and imports happen in the app, not in a table, so the app reports
-- them. The function decides everything it can itself: the actor comes from
-- the JWT, the tenant and template version from the document, and the
-- metadata must match one fixed shape per action.
create function public.record_document_event(
  document_id uuid,
  action text,
  metadata jsonb default '{}'
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  caller uuid := (select auth.uid());
  target public.documents;
  details jsonb := coalesce(record_document_event.metadata, '{}');
  status_name text;
  counts jsonb;
  event_id uuid;
begin
  if caller is null then
    raise exception 'Not authenticated.' using errcode = 'insufficient_privilege';
  end if;
  if action is null or action not in ('document.exported', 'document.imported') then
    raise exception 'Unknown document event.' using errcode = 'invalid_parameter_value';
  end if;
  if jsonb_typeof(details) <> 'object' or octet_length(details::text) > 1024 then
    raise exception 'Event metadata must be a JSON object of at most 1 KiB.'
      using errcode = 'invalid_parameter_value';
  end if;

  select * into target from public.documents where id = record_document_event.document_id;
  -- One answer for "does not exist" and "not yours", so ids cannot be probed.
  if target.id is null or not private.is_tenant_member(target.tenant_id) then
    raise exception 'Document not found.' using errcode = 'insufficient_privilege';
  end if;

  if action = 'document.exported' then
    if (select array_agg(key order by key) from jsonb_object_keys(details) as key)
         is distinct from array['document', 'format']
       or coalesce(details ->> 'format', '') not in ('pdf', 'docx', 'xml')
       or coalesce(details ->> 'document', '') not in ('musterprotokoll', 'anmeldung')
       or (details ->> 'format' = 'xml' and details ->> 'document' <> 'anmeldung') then
      raise exception 'Export metadata must name a supported format and document.'
        using errcode = 'invalid_parameter_value';
    end if;
  else
    -- Serialize the once-per-document import check.
    perform 1 from public.documents where id = target.id for no key update;
    if not found or not private.has_tenant_role(target.tenant_id, '{admin,editor}')
       or target.created_by is distinct from caller
       or target.created_at < now() - interval '1 hour'
       or exists (
         select 1 from public.audit_events as event
         where event.entity_id = target.id and event.action = 'document.imported'
       ) then
      raise exception 'Only the creator can record the import of a new document, once.'
        using errcode = 'insufficient_privilege';
    end if;
    counts := details -> 'counts';
    if (select array_agg(key order by key) from jsonb_object_keys(details) as key)
         is distinct from array['counts', 'model', 'promptVersion']
       or jsonb_typeof(details -> 'model') <> 'string'
       or not exists (
         select 1 from private.app_settings where details ->> 'model' = any(audit_import_models)
       )
       or jsonb_typeof(details -> 'promptVersion') <> 'string'
       or details ->> 'promptVersion' <> 'extract-2026-11-23'
       or jsonb_typeof(counts) <> 'object'
       or (select array_agg(key order by key) from jsonb_object_keys(counts) as key)
         is distinct from array['absent', 'unverified', 'verified'] then
      raise exception 'Import metadata must contain model, promptVersion, and counts per status.'
        using errcode = 'invalid_parameter_value';
    end if;
    foreach status_name in array array['absent', 'unverified', 'verified'] loop
      if jsonb_typeof(counts -> status_name) <> 'object'
         or (select array_agg(key order by key) from jsonb_object_keys(counts -> status_name) as key)
           is distinct from array['accepted', 'cleared', 'edited']
         or exists (
           select 1 from jsonb_each(counts -> status_name) as entry
           where jsonb_typeof(entry.value) <> 'number'
             or entry.value::text !~ '^[0-9]{1,3}$'
         ) then
        raise exception 'Import counts must be whole numbers from 0 to 999.'
          using errcode = 'invalid_parameter_value';
      end if;
    end loop;
  end if;

  -- An event per request is cheap but not free; this bounds a client that
  -- calls the RPC in a loop. Normal use stays far below it.
  if not private.take_quota('audit_event', caller, 120, interval '1 minute') then
    raise exception 'Too many events recorded.' using errcode = 'PT429';
  end if;

  insert into public.audit_events (tenant_id, actor_id, action, entity_type, entity_id, metadata)
  values (
    target.tenant_id, caller, action, 'document', target.id,
    details || private.audit_template(target.template_id, target.template_version)
  )
  returning id into event_id;
  return event_id;
end;
$$;

comment on function public.record_document_event(uuid, text, jsonb) is
  'Records that the caller exported a document or created it from an import. Validates the metadata and takes the actor from the session.';

revoke all on function public.record_document_event(uuid, text, jsonb) from public, anon, service_role;
grant execute on function public.record_document_event(uuid, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: who is who in a firm
-- ---------------------------------------------------------------------------

-- Profiles are private to their owner and emails live in Auth. Members of a
-- firm see each other's display name and email, so the activity panel can
-- say who did what. Nobody outside the firm gets anything.
create function public.list_tenant_members(target_tenant_id uuid)
returns table (
  user_id uuid,
  role public.tenant_role,
  display_name text,
  email text,
  joined_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select membership.user_id, membership.role, profile.display_name, account.email::text, membership.created_at
  from public.tenant_memberships as membership
  join auth.users as account on account.id = membership.user_id
  left join public.profiles as profile on profile.user_id = membership.user_id
  where membership.tenant_id = target_tenant_id
    and private.is_tenant_member(target_tenant_id)
  order by membership.created_at, membership.user_id;
$$;

comment on function public.list_tenant_members(uuid) is
  'The members of a tenant with role, display name, and email. Empty unless the caller is a member.';

revoke all on function public.list_tenant_members(uuid) from public, anon, service_role;
grant execute on function public.list_tenant_members(uuid) to authenticated;

-- The draft and its provenance are a single transaction. Document RLS still
-- applies to this insert because the wrapper runs as the caller.
create function public.create_imported_document(
  target_tenant_id uuid,
  draft_title text,
  draft_data jsonb,
  provenance jsonb
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  document_id uuid;
begin
  insert into public.documents (tenant_id, template_id, template_version, title, data)
  values (target_tenant_id, 'musterprotokoll-einpersonen', '2022-08-01', draft_title, draft_data)
  returning id into document_id;

  perform public.record_document_event(document_id, 'document.imported', provenance);
  return document_id;
end;
$$;

revoke all on function public.create_imported_document(uuid, text, jsonb, jsonb)
  from public, anon, service_role;
grant execute on function public.create_imported_document(uuid, text, jsonb, jsonb)
  to authenticated;
