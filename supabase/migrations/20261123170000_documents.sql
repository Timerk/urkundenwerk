-- Tenant-scoped document drafts. A document stores the structured, possibly
-- incomplete form input for one versioned template. Legal text is never
-- stored: exports assemble it from the template and the validated data.
-- See docs/adr/0005-document-drafts.md.

create type public.document_status as enum ('draft', 'final');

comment on type public.document_status is
  'draft: input may be incomplete and can change; final: reserved for a later milestone.';

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  template_id text not null
    constraint documents_template_id_format check (
      template_id ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(template_id) <= 63
    ),
  template_version text not null
    constraint documents_template_version_format check (
      template_version ~ '^[0-9A-Za-z.-]+$' and char_length(template_version) <= 32
    ),
  title text not null
    constraint documents_title_length check (
      title = btrim(title) and char_length(title) between 1 and 120
    ),
  -- The web app validates drafts against the template's draft schema and
  -- limits them to 32 KiB of JSON. This check is a backstop for other clients.
  data jsonb not null default '{}'
    constraint documents_data_object check (
      jsonb_typeof(data) = 'object' and octet_length(data::text) <= 65536
    ),
  status public.document_status not null default 'draft',
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index documents_tenant_id_updated_at_idx
  on public.documents (tenant_id, updated_at desc);
create index documents_created_by_idx on public.documents (created_by);

comment on table public.documents is
  'A document of a tenant: the structured input for one template version. Legal text is assembled on export, never stored.';
comment on column public.documents.data is
  'Possibly incomplete form input. Validated against the template''s draft schema on write and its full schema on export.';

create trigger documents_touch_updated_at
  before update on public.documents
  for each row execute function private.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Privileges and row-level security
-- ---------------------------------------------------------------------------

-- The template and its version are fixed at creation, and a document never
-- moves to another tenant or changes its author: only title, data, and status
-- are updatable.
revoke all on table public.documents from anon, authenticated;

grant select, delete on table public.documents to authenticated;
grant insert (tenant_id, template_id, template_version, title, data, status, created_by)
  on table public.documents to authenticated;
grant update (title, data, status) on table public.documents to authenticated;

alter table public.documents enable row level security;
alter table public.documents force row level security;

create policy "members can read documents of their tenants"
  on public.documents for select to authenticated
  using (private.is_tenant_member(tenant_id));

create policy "editors can create documents as themselves"
  on public.documents for insert to authenticated
  with check (
    private.has_tenant_role(tenant_id, '{admin,editor}')
    and created_by = (select auth.uid())
  );

create policy "editors can update documents"
  on public.documents for update to authenticated
  using (private.has_tenant_role(tenant_id, '{admin,editor}'))
  with check (private.has_tenant_role(tenant_id, '{admin,editor}'));

create policy "editors can delete documents"
  on public.documents for delete to authenticated
  using (private.has_tenant_role(tenant_id, '{admin,editor}'));
