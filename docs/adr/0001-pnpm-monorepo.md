# ADR-0001 · pnpm workspace with a framework-free core

## Context

The Next.js app and a future MCP server will need the same domain schemas and
rules. Changes to those rules and their consumers should be reviewable together.

## Decision

Use a pnpm workspace with `apps/web` for the Next.js app and `packages/core` for
domain code. Core depends on Zod and exports TypeScript source. Next.js transpiles
that source and Vitest can load it directly.

## Consequences

The app and future services can share schemas and rules from one workspace.
Keep framework APIs in the applications. Future consumers need TypeScript-aware
tooling or a build step for core.
