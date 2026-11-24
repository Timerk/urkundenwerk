# ADR-0014 · Tenant audit log and retention

Status: Accepted

## Context

Firms need to see who changed a draft or a membership. Keeping the contents
of documents or past personal values in a second store would make it harder
to minimise data and honour erasure requests. The hosted demo already has
tenants and drafts.

## Decision

PostgreSQL triggers log changes to documents, memberships and firm names.
Exports from the web and MCP and confirmed imports use
`record_document_event` under the caller's session. The RPC takes the actor and
document identity from the database, enforces membership, validates the
metadata and limits calls. It records what the application reports. It does
not independently attest to a download or model invocation.

Document changes include known field paths, never the old or new values.
Repeated autosaves of fields from the same actor and draft can coalesce
within ten minutes. Confirmed imports record a model identifier, prompt
version and decision counts per verification status. Source text, extracted
values and per-field decisions are excluded.

Only admins can browse their entire firm's history. Editors and viewers can
read events for documents they can still open. Current member names and
emails come from the firm directory. Audit rows store account references,
which are cleared by foreign keys when an account is deleted. Events for a
firm are deleted when the firm itself is deleted. Client roles cannot
insert, update, delete or truncate audit rows.

Migrations start the log at deployment without backfilling historical events.
An operator can schedule `select private.prune_audit_events();` and configure
`private.app_settings.audit_retention` for their deployment. The default is
ten years. It is an operational default, not a statutory retention period for
this log. A real firm should document how long it needs an audit trail and
distinguish it from its obligations for notarial records. Shorter periods
reduce how long the log identifies staff. The approval-gated demo reset
prunes events older than 90 days.

## Consequences

History helps a firm review draft and access changes. It is an application
audit trail, not a complete revision history or a tamper-proof archive
against a database operator. A failed explicit event can be retried subject
to the RPC's limits.
