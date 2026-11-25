# ADR-0013 · Hosted public demo

## Context

The portfolio demo needs a public web URL, a repeatable starting state, and
a cap on paid provider calls across serverless instances. The repository
also includes a local stdio MCP server and a fictional evaluation corpus.

## Decision

Vercel runs the Next.js app from `apps/web` in `fra1`, with Node 24 and the
committed pnpm workspace. Supabase Auth and Postgres run in Frankfurt.
GitHub Actions pushes reviewed migrations using the protected `production`
environment. The database runs the nightly reset with pg_cron
([ADR-0016](0016-database-demo-reset.md)). The operator deploys a
reviewed `master` revision after database changes succeed. PR previews
are disabled. A future preview deployment needs a separate database and
scripted AI. The MCP server remains local.

Disable public sign-up in the app and Supabase Auth. Offer one-click login
to four pre-provisioned accounts: an editor, a viewer, a member of two
firms, and the admin of a sandbox firm. The server action
checks an email allow-list and reads the password from server env, so the
shared password need not be delivered to browsers. An operator-only user
administers the Nord and Süd firms. The nightly reset restores the fictional
sample drafts and deletes other drafts in the demo firms. It restores the
sandbox firm's memberships and invitations. It preserves other firms,
users, quotas, and the memberships of Nord and Süd. ADR-0016 records why
the reset moved from a GitHub Actions schedule to pg_cron. It also records
the sandbox design.

`create_tenant` serializes creation per user and caps firms created by the
same user at three. A private ledger records creators from this migration
onward, including when their memberships change. Deleting a firm frees a
slot. Hosted visitor accounts are marked in Auth app metadata and cannot
create firms.

The web app calls one authenticated RPC with the caller's user session
before each paid provider attempt, including retries. PostgreSQL uses
`auth.uid()` and applies per-user windows of 10 explanation attempts per
minute and 6 import attempts per ten minutes. The RPC then reserves a slot
in the global budget in the same transaction. If the global budget is
exhausted, the user counter rolls back. The operator sets the limit in a
private settings row that defaults to zero. The budget resets at midnight
UTC. A quota lookup failure prevents paid calls. The scripted fake uses
no paid quota. Explanations use a bounded per-instance cache. A cold
cache may repeat a request, which still consumes a budget slot. Keeping
the cache in memory avoids a database read and write for each explanation
without weakening either limit.

Next configuration sets HSTS, MIME sniffing protection, referrer and
permissions policies, and framing protection. In production the proxy
adds a request-specific script nonce, supplies it to the renderer, and
allows browser connections to the configured Supabase origin. Fonts are
self-hosted. The document preview uses a style attribute for alignment.
Dynamic rendering supplies fresh nonces without allowing inline scripts
generally or using eval. The health route bypasses the auth and CSP proxy
and calls `public.health_check()` through PostgREST with the publishable
key. The function uses caller privileges and reads no tenant data. The
route reports database health and the deployment SHA, returning 503 on
missing configuration, RPC failure, or a five-second timeout.

GitHub Actions calls the health route roughly every two days to generate
database activity on the Supabase Free plan and detect outages. An
external uptime monitor can continue checks independently of GitHub's
60-day repository inactivity limit for scheduled workflows.

## Consequences

Visitors see each other's edits in the same firm until the next nightly
reset. The two roles demonstrate isolation and authorization using
fictional data. A busy shared account can hit its rate limit, and spending
the daily budget blocks import and returns deterministic rule summaries
for explanations requiring a paid call. Local development keeps its
original seed, one-click demo accounts, and registration flow.

[Deployment guide](../deployment.md)
