import { execFileSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const cli = join(
  dirname(require.resolve("supabase/package.json")),
  "dist",
  "supabase.js",
);

/**
 * Runs the workspace's pinned Supabase CLI and returns its standard output.
 * Diagnostics such as update notices stay on standard error.
 */
export function runSupabase(args) {
  return execFileSync(process.execPath, [cli, ...args], {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });
}
