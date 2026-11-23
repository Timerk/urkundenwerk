# ADR-0003 · Multi-tenancy with Postgres row-level security

## Context

Each law firm is a tenant. Firms must never see each other's data, including
through bugs in the web app, the future MCP server, or direct calls to the
Supabase Data API with a user's token. A user can belong to several firms with
a different role in each.

## Decision

Keep all tenants in shared tables with a `tenant_id` and enforce isolation in
Postgres with row-level security (RLS). `public.tenant_memberships` is the only
source of access. Policies call two `SECURITY DEFINER` helpers in a `private`
schema that the Data API does not expose: `private.is_tenant_member(tenant_id)`
and `private.has_tenant_role(tenant_id, roles)`. Both answer questions about
`auth.uid()` only and pin an empty `search_path`.

Policies exist per command and only for the `authenticated` role. Table and
column grants limit what each command can reach, for example only `role` on a
membership can be updated. `anon` has no privileges. Tenants are created with
the `public.create_tenant` RPC, which makes the caller the first admin.

We rejected two alternatives:

- **Schema per tenant** isolates data physically but multiplies migrations,
  breaks cross-tenant memberships, and does not fit the Supabase Data API.
- **Filtering in the application** puts isolation in every query of every
  client. One missing `where tenant_id = …` would leak data, and direct API
  access would bypass it.

## Consequences

Isolation holds for every client that uses a user token, and it is tested in
the database itself. pgTAP tests assert that every table in `public` has RLS
and policies, so new tables fail CI until they are protected. Every new tenant
table needs policies that call the helpers. Server code that uses the Supabase
secret key bypasses RLS and must stay limited to operator tasks.
