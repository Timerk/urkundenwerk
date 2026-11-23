# ADR-0011 · MCP server acting as the signed-in user

## Context

M6 lets an AI agent such as Claude Code or Claude Desktop operate
Urkundenwerk: list firms and documents, create and change drafts, run the
rule checks, and export the deed. The agent works on client data, so it must
not be able to see or change more than the person it acts for. ADR-0003 puts
tenant isolation in Postgres row-level security, and ADR-0002 forbids an LLM
from writing legal text. The server must respect both without its own copy
of the access rules.

## Decision

**Transport.** `apps/mcp` (`@urkundenwerk/mcp`) is a Model Context Protocol
server on the official TypeScript SDK v2 (`@modelcontextprotocol/server`).
It speaks stdio: the MCP client starts it as a local subprocess, and stdout
carries only the protocol. Diagnostics go to stderr and contain neither
credentials nor document data; database errors are logged by code only,
because Postgres messages can quote row values.

**Authentication through the user's own session.** The server reads the
Supabase URL, the publishable key, and one user's email and password from
its environment, validates them with Zod, and signs in with Supabase Auth.
Every query then carries that user's JWT, so the same RLS policies as in the
web app decide which firms and documents exist for the agent and which
writes succeed. The session lives in memory. supabase-js refreshes the
access token before it expires, and the server signs in again if the
refresh token is no longer accepted. Shutting down signs the session out.

**No service key.** The configuration refuses `sb_secret_…` keys and legacy
JWT keys with the `service_role` claim. A service key bypasses RLS, so the
server would have to re-implement tenant and role checks, and any bug or
prompt injection that reached a tool could cross tenants. With the user's
session, the worst a confused agent can do is what the user could do in
the browser.

**Tools.** Eight small tools with an `urkundenwerk_` prefix, Zod input
schemas, output schemas with structured content, and annotations: list
firms, list documents (paginated, with completeness), get a document,
create a draft, update a draft (deep merge plus `unset` paths, with an
optimistic check on `updated_at` so a concurrent save in the web app is not
overwritten), validate a document, export it, and delete a draft (marked
destructive). Tools that work in a firm take an optional `tenant` slug or
id; without it, the only membership is used, or the error lists the firms.
The server checks roles before writes to give a clear message, and RLS
enforces them again. Two resources publish the draft JSON Schema and the
rule list, and one prompt guides an agent from facts to a validated draft.

**Same pipeline, no legal text.** Drafts are validated with the core draft
schema and the web app's 32 KiB limit. Validation runs the core rule engine
with today's date in Germany. An export requires the rules for the selected
document to pass. PDF and DOCX exports build the `DocumentModel` with core
and render it with `@urkundenwerk/render`. XML exports use a timestamp from
the server clock and validate the generated XML against the XSD. Exports
return the file base64-encoded as an embedded resource with its MIME type
and suggested filename. With
`URKUNDENWERK_EXPORT_DIR` set, it can also write the file below that
directory; absolute paths, `..`, and symlinks out of the root are refused.
The agent only moves structured data; it never writes or edits deed text.

**Data access.** The server has a thin `DocumentStore` port with a Supabase
implementation that mirrors `apps/web/src/lib/documents/repository.ts`.
We did not extract a shared package in this milestone: the web repository
imports `server-only` and is being changed by the concurrent M5 work, and
the MCP server needs a port it can fake in tests anyway. Both run the same
queries against the same RLS policies, so a divergence cannot widen access.
Moving both onto one `packages/data` repository is a follow-up once M5 has
landed.

We rejected two alternatives:

- **A service key with checks in the server** would duplicate the policies
  and make a single bug a cross-tenant leak (ADR-0003).
- **Calling the web app's HTTP routes** would need a second, cookie-based
  session and offers no create, update, or validate API.

## Consequences

An agent can draft, check, and export documents with exactly the user's
rights, and the isolation tests of the database cover it too. Integration
tests drive the server over the SDK's in-memory transport against local
Supabase as seeded users, and CI also runs it once over stdio.

The password sits in the MCP client's configuration and the server's memory
for as long as it runs, so the setup suits local use with demo or personal
accounts. The outlook for hosted use is the Streamable HTTP transport with
OAuth 2.1: the MCP client obtains a Supabase-issued access token for the
user through an authorization flow, the server verifies it and creates a
per-request client with that token, and no password reaches the server.

The MCP server now accepts the optional `filing` section on the same draft
and supports Handelsregisteranmeldung PDF and DOCX exports and XSD-validated
register filing XML through `urkundenwerk_export_document`.
