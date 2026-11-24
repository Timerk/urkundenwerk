# ADR-0016 · Database-scheduled demo reset and sandbox admin

Status: Accepted. Amends [ADR-0013](0013-hosted-public-demo.md).

## Context

A GitHub Actions schedule ran the nightly reset of the hosted demo in the
`production` environment. That environment requires a reviewer, so each
scheduled run waited for approval and the reset did not run unattended.
Visitors' edits to the shared sample drafts remained. A sample draft
changed to an invalid capital blocked exports for every visitor. The job
also needed a Supabase access token that expires every 30 days.

Visitors could only sign in as an editor, a viewer, or a member of two
firms, so nobody could see the members page or the audit log. The admin of
the Nord and Süd firms is the operator account. If a visitor were admin
there, they could demote or remove the shared accounts and break the demo
for everyone until an operator repaired it.

## Decision

Postgres runs the reset itself. A migration enables `pg_cron` and creates
`private.reset_hosted_demo()`, a `security definer` function with an empty
`search_path`. No client role can execute it. The migration schedules the
function at 02:17 UTC under the job name `reset-hosted-demo`.
`cron.schedule` replaces an existing job of that name, so running the
migration again keeps one job. The job needs no GitHub approval, access
token, or secret outside the database.

The function identifies the demo by the fixed IDs and slugs of its seeded
firms. In any other database, including local development and CI, it
returns `false` and changes nothing. An enable flag in
`private.app_settings` would have required manual SQL on the hosted
project, because migrations deploy the same settings everywhere. A firm
with a different slug keeps the function inactive, so an ID collision
cannot cause a reset.

The approval-gated `reset-demo.yml` workflow remains for an immediate
reset. It has only manual dispatch and calls the same function through
`supabase/demo/reset.sql`.

The hosted login adds `sara.admin@demo.test` as the admin of a separate
sandbox firm, Demo-Kanzlei West. Erik and Victor are its editor and viewer,
and it has two sample drafts. Sara has no membership in Nord or Süd. The
account is protected from deletion like the other shared accounts. It is
marked as a demo account, so it cannot create firms. A trigger stops a
signed-in session from demoting or removing Sara in West. Otherwise one
visitor could leave all others without access to the admin pages for the
rest of the day. Operator and system changes without a JWT pass.

Each night, the reset restores:

- the sample drafts in all three firms and removes other drafts there;
- the names of the three demo firms;
- West's memberships and roles, removing members visitors added, and its
  invitations;
- the display names of the five demo accounts, which users can change
  through the Data API.

Unchanged samples are left alone, so the audit log records only resets of
drafts that visitors changed. The reset also keeps the 90-day audit and
invitation retention described in [ADR-0014](0014-audit-log.md).

## Consequences

The reset runs unattended, and visitors can see the members page,
invitations, and the audit log. Sandbox changes, including invitations to
arbitrary addresses, are visible to other visitors until the next reset.
Hosted sign-up is disabled, so such an invitation can be accepted only by an
existing account. An admin visitor can rename West or promote Erik or Victor
to admin there until the next reset. Nord and Süd stay under the operator's
control.

Failures appear in `cron.job_run_details`, not in GitHub. The operator
checks that table during smoke tests. pg_cron keeps one row per run, so the
history grows by one row each night. The operator creates Sara's Auth user,
because neither CI nor the repository has an admin key. The hosted seed is
idempotent, so it can add the account to an existing demo.

[Deployment guide](../deployment.md)
