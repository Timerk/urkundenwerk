# ADR-0005 · Document drafts store structured input, not text

## Context

Lawyers fill in a Musterprotokoll over several sessions, so incomplete input
must survive a reload. Every export must still be assembled deterministically
from a versioned template (ADR-0002), and a firm must never see another firm's
drafts (ADR-0003).

## Decision

Store each document in `public.documents` as the template id, the template
version, a title, and the structured form input as `jsonb`. The table stores no
legal text. Exports validate the input with the template's full Zod schema and
assemble the text on demand.

Drafts use a separate draft schema in core: a deep-partial of the input schema
with strict objects, length limits, and the fields of both founder and managing
director alternatives, so switching between them keeps what was typed. The web
app rejects unknown keys and drafts over 32 KiB of JSON before writing. A
database check limits `data` to JSON objects up to 64 KiB for other clients.

The table follows ADR-0003. All members of a tenant read its documents;
editors and admins create, update, and delete them; viewers only read. Column
grants make the tenant, template, version, and author immutable after insert,
and the insert policy requires `created_by = auth.uid()`. The web app uses the
per-request Supabase client with the user's session for every document query,
never the secret key.

Exports run in a Node route handler that loads the document through RLS,
validates it, and returns PDF or DOCX with `Cache-Control: no-store`.
Incomplete input yields `422` with the Zod issue paths and codes. Next.js
bundles the renderer and emits its font file as a server asset. PDFKit stays an
external package because it loads its default font from its own directory.

## Consequences

Drafts stay valid across template wording changes, because only data is
stored. A document is bound to the template version it was created with; an
export for a version the registry no longer provides fails with `409` until a
migration path exists. `status = 'final'` is reserved for signing and locking
in a later milestone.
