# Privacy and data protection

Urkundenwerk is a public demonstration for fictional case data. The hosted
demo's [deployment guide](deployment.md) identifies configuration and
operator responsibilities. The privacy notice and legal notice are public
routes in both UI languages.

## Data inventory and retention

| Data                                                                  | Purpose and retention                                                                                                                                                                                                                                |
| --------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Supabase Auth account, profile, firm membership and role              | Authentication, authorization and the firm directory. The account and its memberships are removed from the live database on account deletion.                                                                                                        |
| Invitation address, role, sender, token hash and lifecycle timestamps | Allow consent-based access. An invitation is valid for seven days. The demo removes invitation records 90 days after expiry. It removes invitations addressed to an account when that account is deleted.                                            |
| Structured drafts, template versions, titles and author references    | Assemble deterministic documents. Drafts belong to the firm. Sample firms are reset nightly. Other firms' drafts remain until removed by an authorized member or the firm is deleted. Account erasure detaches the author reference.                 |
| Audit events and actor/subject references                             | Record changes and exports. Event details use known field paths and bounded metadata. Account deletion clears the references. The demo prunes events older than 90 days. Other deployments set the operator's retention policy and schedule pruning. |
| Quota counters, technical request and provider logs, backups          | Operate and protect the service. Per-user database counters are removed on account deletion. Provider logs and backups expire on their respective schedules.                                                                                         |
| Session and locale cookies, tab-local invitation token                | Keep the user signed in, remember the active firm and language, and return the invitee to acceptance after login. The firm preference is a session cookie. The locale cookie has a one-year maximum.                                                 |

Uploaded files and extracted text are held temporarily for processing and
review. The app stores the accepted structured draft and limited provenance.
It does not retain the source document, quoted text or raw model response.

## Processors and transfers

- Supabase hosts PostgreSQL and Auth in the selected EU region. Its service
  can involve processing outside that region. Review its transfer and
  subprocessor terms. [Supabase transfer FAQ](https://supabase.com/legal/privacy-resources/data-residency-and-transfers-faq).
- Vercel deploys the web application and runs server functions in Frankfurt
  (`fra1`). Edge delivery and other service processing may occur elsewhere.
  [Vercel regions](https://vercel.com/docs/regions).
- OpenAI receives data only when a user invokes an enabled AI feature.
  Extraction sends fictional contract text. Explanations send a limited
  set of fictional rule inputs. The project's ordinary API configuration
  should not be treated as an EU-only processing commitment.
  [OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data).

## Technical and organisational measures

The web app uses the Supabase publishable key and the authenticated user's
session. PostgreSQL row-level security enforces tenant boundaries. Admins
can manage access and review all audit events for their firm. Editors and
viewers see events for documents they can open. Members can identify their
colleagues and their roles in a read-only directory. Invitation secrets
are one-time values and are not stored in plaintext. Audit metadata omits
historical field values, document text and invitee addresses. The demo
reset and database deployments require approval. See
[ADR-0014](adr/0014-audit-log.md) and
[ADR-0015](adr/0015-invitations-and-account-data.md).

## Data-subject rights

The Account page provides a JSON download for part of the information
relevant to access and portability under Articles 15 and 20 GDPR. It
contains the profile, current firm memberships, invitations sent without
recipient addresses, audit events attributed to the caller, and IDs and
titles of drafts they created and can still read. The operator handles the
full Article 15 response, rectification, restriction, objection and
applicable portability requests, including data held outside the app.

For Article 17 erasure, Account deletes the caller from live Auth once
the caller confirms. Account erasure is blocked for shared demo accounts and
for a last admin where other firm members remain. A sole member can
explicitly confirm deletion of their firm and its drafts. For continuing
firms, their drafts remain and the relevant account references are cleared.
Provider backups and records subject to a documented retention obligation
follow their own processes. A data subject may complain to a supervisory
authority under Article 77. [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj).

## Before using real client data

- Determine the controller and processors, document purposes and legal
  bases, and sign processor agreements (AVV/DPA) where required by Article
  28 GDPR. Identify subprocessors and assess any third-country transfers
  under Articles 44–49. EU application hosting alone does not settle
  those questions. [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj).
- Protect professional secrets under § 203(1) no. 3 StGB. Limit access by
  external contributors to what is necessary under § 203(3) and assess the
  confidentiality obligations and consequences in § 203(4).
  [§ 203 StGB](https://www.gesetze-im-internet.de/stgb/__203.html).
- For lawyers, apply § 43e(1)–(3) BRAO to necessity, vendor selection and
  confidentiality terms in text form. Review services abroad under
  § 43e(4) and client consent for services directly serving an individual
  mandate under § 43e(5), subject to the statute's exceptions.
  [§ 43e BRAO](https://www.gesetze-im-internet.de/brao/__43e.html).
- For notaries, review § 26a(1)–(3) BNotO for necessity, service provider
  selection and confidentiality terms. Where a service directly supports
  a specific official notarial act, § 26a(4) requires the party's consent
  for access to secrets. Further restrictions on outsourcing and data
  protection continue to apply under § 26a(7).
  [§ 26a BNotO](https://www.gesetze-im-internet.de/bnoto/__26a.html).
- Document a DPIA screening and perform the DPIA before processing where
  Article 35 GDPR requires it. Adopt a deletion concept for drafts, logs,
  invitations, backups and downstream providers. Reconcile minimisation
  and storage limitation with applicable notarial and legal retention
  obligations. Configure and test the operator's retention jobs.
  [GDPR](https://eur-lex.europa.eu/eli/reg/2016/679/oj).
- Keep AI disabled for real client data unless an EU-hosted model and its
  complete processing chain have been approved for the specific use.
  Deterministic drafting and export work with AI disabled.
