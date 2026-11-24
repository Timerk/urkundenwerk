# ADR-0015 · Consent-based membership and account self-service

Status: Accepted

## Context

Firm admins previously could add existing users by ID. A user could be
made a member without accepting. A firm could also lose its only admin when
the underlying Auth account was deleted.

## Decision

A firm admin creates an invitation with a normalized address and role.
The database generates a 256-bit secret, keeps only its SHA-256 hash and
returns the secret to the creating request. The admin copies the link.
The application sends no emails. The link carries the token in the URL
fragment, which the invite page removes from the address bar and keeps in the
current tab until the login round trip finishes. Acceptance requires the
current confirmed email address from Supabase Auth. Expiry, revocation and
one-use consumption are checked in the same transaction as membership
creation. Admins can read invitations for their firms without access to
hashes. Only the tenant-creation and invitation-acceptance RPCs can insert
memberships through the Data API.

Every member may read their firm's directory so they can identify
colleagues and understand who has access. Admins can manage roles and
invites. The hosted demo disables public sign-up, so an invitee needs an
existing account.

The account download uses a caller-scoped SQL projection. It omits other
users' email addresses, invite secrets and audit subjects. It includes IDs
and titles of drafts the caller created and can still read. Their contents
remain firm data.

Account erasure uses a narrow security-definer function installed by the
database migration role. It deletes the current caller from `auth.users`
in the database. The web app uses the publishable key and the user's
session. The database protects shared demo accounts by ID and email.
Erasure refuses to leave an occupied firm without an admin. The caller
must additionally confirm deletion of any firm in which they are the
only member. For continuing firms, foreign keys detach account references
and the audit record remains.

Supabase access tokens already issued can remain valid until expiry. The
database removes memberships during account deletion, so those tokens
lose tenant access under RLS. The web app also verifies protected requests
with Auth. [Supabase user management](https://supabase.com/docs/guides/auth/managing-user-data).

## Consequences

Existing users, memberships and firm data survive deployment. Invites are
subject to a quota of ten per hour per admin. Operators provision accounts
outside this flow when sign-up is disabled. Backup and provider retention
are operational responsibilities. See [privacy and retention](../privacy.md).
