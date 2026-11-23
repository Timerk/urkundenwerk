# Engineering conventions

## Layout and commands

- `apps/web` contains the Next.js App Router app and Playwright tests.
- `packages/core` contains framework-free domain code, Zod schemas, and their tests.
- `docs/adr` records architecture decisions.
- Run `pnpm install --frozen-lockfile`, then `pnpm dev` for local development.
- Run `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, and
  `pnpm build`. For browser tests, install Chromium with
  `pnpm --filter @urkundenwerk/web exec playwright install chromium` and run
  `pnpm test:e2e` after the build. Use `pnpm format` to apply formatting.

## Git and pull requests

- Work on a branch such as `feat/…`, `fix/…`, or `chore/…`.
- Use Conventional Commits for commits and PR titles. The form is
  `type(scope): imperative summary`. Scope is optional. Allowed types are
  `feat`, `fix`, `chore`, `docs`, `test`, `refactor`, `ci`, and `build`.
- Land changes through reviewed PRs with green CI. Squash-merge using the PR
  title as the commit message.

## Domain rules

- Assemble legal text deterministically from versioned templates and validated
  structured data. LLMs may extract data or explain results. Never generate legal
  document text with an LLM.
- Validate all external data with Zod at the boundary.
- Keep LLM SDKs behind adapters. Mock those adapters in tests and never call
  paid APIs from a test.
- Use fictional case and personal data and public legal source texts. Keep
  secrets and real personal data out of the repository.
- Enable and test PostgreSQL row-level security on every tenant table.

## Definition of done

- The PR describes the change, links its issue, and gives verification steps.
- Relevant tests cover the changes, and CI passes.
- Documentation and ADRs reflect the behavior and decisions affected by the PR.
- A reviewer has approved the PR.
