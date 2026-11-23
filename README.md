<img src="assets/icon.svg" width="64" height="64" alt="">

# Urkundenwerk

Urkundenwerk is an AI-assisted document builder for German law firms. Its first
planned workflow covers forming a German GmbH with the statutory
`Musterprotokoll` (Anlage 1 GmbHG) and preparing the `Handelsregisteranmeldung`.
The app currently provides sign-up, sign-in, a firm workspace on a
multi-tenant Supabase backend, document drafts per firm, and PDF and DOCX
exports of complete drafts.

> **Demonstration project. Not legal advice.** Urkundenwerk uses fictional case
> data and public legal texts only.

## Roadmap

| Milestone                                                                      | Scope                                                                  | Status      |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ----------- |
| [M1 · Foundation](https://github.com/Timerk/urkundenwerk/issues/1)             | Monorepo, CI, Supabase Auth, and row-level security (RLS)              | Done        |
| [M2 · Template engine](https://github.com/Timerk/urkundenwerk/issues/2)        | Deterministic DOCX and PDF rendering                                   | In progress |
| [M3 · Rule checks](https://github.com/Timerk/urkundenwerk/issues/3)            | Validation of structured formation data                                | Planned     |
| [M4 · AI extraction](https://github.com/Timerk/urkundenwerk/issues/4)          | Extract structured data with source citations and evaluate the results | Planned     |
| [M5 · XML export](https://github.com/Timerk/urkundenwerk/issues/5)             | Export registry XML and validate it against an XSD                     | Planned     |
| [M6 · MCP server](https://github.com/Timerk/urkundenwerk/issues/6)             | Expose the shared domain workflows over MCP                            | Planned     |
| [M7 · Audit, roles, and GDPR](https://github.com/Timerk/urkundenwerk/issues/7) | Audit log, role-based access, and data protection workflows            | Planned     |
| [M8 · Deployment](https://github.com/Timerk/urkundenwerk/issues/8)             | Deploy the portfolio demo                                              | Planned     |

## Stack and layout

The project uses pnpm, Next.js App Router, React, TypeScript, Tailwind CSS, Zod,
and Supabase (Postgres, Auth, and RLS). Vitest, pgTAP, and Playwright run in
GitHub Actions, and Docker Compose runs the standalone web build locally.
Vercel is planned.

| Path                                 | Purpose                                                                     |
| ------------------------------------ | --------------------------------------------------------------------------- |
| [`apps/web`](apps/web)               | Next.js app, Playwright tests, and Dockerfile                               |
| [`packages/core`](packages/core)     | Framework-free TypeScript domain package and Zod schemas                    |
| [`packages/render`](packages/render) | Node DOCX and PDF export for the [template engine](packages/core/README.md) |
| [`supabase`](supabase)               | Migrations, seed data, pgTAP tests, and local config                        |
| [`docs/adr`](docs/adr)               | Architecture decisions                                                      |

The shared TypeScript config enables `strict` and `noUncheckedIndexedAccess`.
It leaves `exactOptionalPropertyTypes` off so app and schema types can use the
same optional property conventions as Next.js and Zod.

## Local development

Use Node.js 24 LTS (`.nvmrc`), pnpm 12.23.0, and a running Docker engine (for
example Docker Desktop) for the local Supabase stack.

```sh
pnpm install --frozen-lockfile
pnpm db:start   # Postgres, Auth, and the Data API; applies migrations and seed data
pnpm db:env     # writes the local URL and publishable key to apps/web/.env.local
pnpm dev
```

Open <http://localhost:3000> and sign in with one of the fictional demo users.
Their password is `demo-password-123`. It exists only in the local seed data.

| Email                     | Firm              | Role   |
| ------------------------- | ----------------- | ------ |
| `anna.admin@demo.test`    | Demo-Kanzlei Nord | admin  |
| `erik.editor@demo.test`   | Demo-Kanzlei Nord | editor |
| `victor.viewer@demo.test` | Demo-Kanzlei Nord | viewer |
| `sara.admin@demo.test`    | Demo-Kanzlei Süd  | admin  |

Each firm has one fictional draft: a complete Musterprotokoll for Nord and an
unfinished one for Süd.

Local sign-up skips email confirmation (`[auth.email]` in
[`supabase/config.toml`](supabase/config.toml)), so `/signup` signs the new
user in and creates their firm immediately. Hosted Auth settings are part of
the deployment milestone. [`.env.example`](.env.example) lists all variables.
The other keys there are reserved for later integrations.

To run the production image locally, use `docker compose up --build` and open
the same URL. The image serves the public pages; the authenticated area needs
the Supabase variables at runtime.

| Command                             | Purpose                                              |
| ----------------------------------- | ---------------------------------------------------- |
| `pnpm lint`                         | Check JavaScript and TypeScript with ESLint          |
| `pnpm format` / `pnpm format:check` | Write or check formatting with Prettier              |
| `pnpm typecheck`                    | Type-check all workspace packages                    |
| `pnpm test`                         | Run the workspace unit tests                         |
| `pnpm build`                        | Build the standalone production app                  |
| `pnpm test:e2e`                     | Run the Chromium tests against the production build  |
| `pnpm db:start` / `pnpm db:stop`    | Start or stop the local Supabase stack               |
| `pnpm db:reset`                     | Recreate the local database from migrations and seed |
| `pnpm db:test`                      | Run the pgTAP database tests                         |
| `pnpm db:lint`                      | Lint the database schema                             |
| `pnpm db:types`                     | Regenerate `packages/core/src/db/database.types.ts`  |
| `pnpm db:env`                       | Write the local Supabase variables for the web app   |

Before running the end-to-end tests locally, install Chromium with
`pnpm --filter @urkundenwerk/web exec playwright install chromium`, start the
database with `pnpm db:start`, and run `pnpm build`.

## Security model

- **Tenants.** Each law firm is a tenant. Users get access to a tenant only
  through a row in `tenant_memberships`, so one user can belong to several
  firms.
- **Roles.** `admin` manages the firm and its members, `editor` creates and
  edits documents, and `viewer` reads them. Only admins add, change, or remove
  memberships, and every tenant keeps at least one admin.
- **Row-level security.** Postgres enforces isolation, not the app. Every
  table in `public` has RLS enabled and forced, with policies for the
  `authenticated` role only. The policies use `SECURITY DEFINER` helpers in a
  `private` schema that the Data API does not expose. Anonymous requests have
  no table privileges. See [ADR-0003](docs/adr/0003-tenancy-with-row-level-security.md).
- **Documents.** `documents` rows store structured input, never legal text.
  Members read their firm's documents, editors and admins write them, and
  column grants keep the tenant, template version, and author fixed. Server
  actions and the export route use the signed-in user's Supabase client, so
  RLS authorizes every query. See
  [ADR-0005](docs/adr/0005-document-drafts.md).
- **Authentication.** The Next.js proxy refreshes the Supabase session.
  Protected pages verify the user with the Auth server through
  `supabase.auth.getUser()` and do not trust the session cookie alone.
- **Data minimisation.** `profiles` stores a display name only. Email
  addresses stay in Supabase Auth.
- **Tests.** pgTAP tests in [`supabase/tests`](supabase/tests) check RLS on
  every table through the catalog, so new tables are covered automatically.
  They also sign in as members of two tenants and prove that reads, writes,
  role escalation, and anonymous access across tenants fail. Playwright covers
  sign-in, sign-up, the redirect for unauthenticated users, and exports
  across firms.

## How this project is built

An orchestrating agent plans milestones and reviews pull requests.
Implementation agents work on feature branches. Changes land through reviewed
pull requests with green CI and are squash-merged using the PR title as the
commit message. The engineering conventions are in [`AGENTS.md`](AGENTS.md).
