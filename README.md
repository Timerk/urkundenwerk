<img src="assets/icon.svg" width="64" height="64" alt="">

# Urkundenwerk

Urkundenwerk is an AI-assisted document builder for German law firms. Its first
planned workflow covers forming a German GmbH with the statutory
`Musterprotokoll` (Anlage 1 GmbHG) and preparing the `Handelsregisteranmeldung`.
The current scaffold serves a placeholder page.

> **Demonstration project. Not legal advice.** Urkundenwerk uses fictional case
> data and public legal texts only.

## Roadmap

| Milestone                                                                      | Scope                                                                  | Status      |
| ------------------------------------------------------------------------------ | ---------------------------------------------------------------------- | ----------- |
| [M1 · Foundation](https://github.com/Timerk/urkundenwerk/issues/1)             | Monorepo, CI, Supabase Auth, and row-level security (RLS)              | In progress |
| [M2 · Template engine](https://github.com/Timerk/urkundenwerk/issues/2)        | Deterministic DOCX and PDF rendering                                   | In progress |
| [M3 · Rule checks](https://github.com/Timerk/urkundenwerk/issues/3)            | Validation of structured formation data                                | Planned     |
| [M4 · AI extraction](https://github.com/Timerk/urkundenwerk/issues/4)          | Extract structured data with source citations and evaluate the results | Planned     |
| [M5 · XML export](https://github.com/Timerk/urkundenwerk/issues/5)             | Export registry XML and validate it against an XSD                     | Planned     |
| [M6 · MCP server](https://github.com/Timerk/urkundenwerk/issues/6)             | Expose the shared domain workflows over MCP                            | Planned     |
| [M7 · Audit, roles, and GDPR](https://github.com/Timerk/urkundenwerk/issues/7) | Audit log, role-based access, and data protection workflows            | Planned     |
| [M8 · Deployment](https://github.com/Timerk/urkundenwerk/issues/8)             | Deploy the portfolio demo                                              | Planned     |

## Stack and layout

The scaffold uses pnpm, Next.js App Router, React, TypeScript, Tailwind CSS, and
Zod. Vitest and Playwright run in GitHub Actions, and Docker Compose runs the
standalone web build locally. Supabase (Postgres, Auth, and RLS) and Vercel are
planned.

| Path                                 | Purpose                                                                     |
| ------------------------------------ | --------------------------------------------------------------------------- |
| [`apps/web`](apps/web)               | Next.js app, Playwright tests, and Dockerfile                               |
| [`packages/core`](packages/core)     | Framework-free TypeScript domain package and Zod schemas                    |
| [`packages/render`](packages/render) | Node DOCX and PDF export for the [template engine](packages/core/README.md) |
| [`docs/adr`](docs/adr)               | Architecture decisions                                                      |

The shared TypeScript config enables `strict` and `noUncheckedIndexedAccess`.
It leaves `exactOptionalPropertyTypes` off so app and schema types can use the
same optional property conventions as Next.js and Zod.

## Local development

Use Node.js 24 LTS (`.nvmrc`) and pnpm 12.23.0. The scaffold runs without environment variables. The keys in
[`.env.example`](.env.example) are reserved for later integrations.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Open <http://localhost:3000>. To run the production image locally, use
`docker compose up --build` and open the same URL.

| Command                             | Purpose                                                  |
| ----------------------------------- | -------------------------------------------------------- |
| `pnpm lint`                         | Check JavaScript and TypeScript with ESLint              |
| `pnpm format` / `pnpm format:check` | Write or check formatting with Prettier                  |
| `pnpm typecheck`                    | Type-check all workspace packages                        |
| `pnpm test`                         | Run the workspace unit tests                             |
| `pnpm build`                        | Build the standalone production app                      |
| `pnpm test:e2e`                     | Run the Chromium smoke test against the production build |

Before running the end-to-end test locally, install Chromium with
`pnpm --filter @urkundenwerk/web exec playwright install chromium` and run
`pnpm build`.

## How this project is built

An orchestrating agent plans milestones and reviews pull requests.
Implementation agents work on feature branches. Changes land through reviewed
pull requests with green CI and are squash-merged using the PR title as the
commit message. The engineering conventions are in [`AGENTS.md`](AGENTS.md).
