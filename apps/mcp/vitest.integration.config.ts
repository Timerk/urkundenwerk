import { defineConfig } from "vitest/config";

// Runs against the local Supabase stack (`pnpm db:start`). Tests sign in as
// the seeded demo users and clean up the drafts they create.
export default defineConfig({
  test: {
    include: ["src/**/*.integration.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    fileParallelism: false,
  },
});
