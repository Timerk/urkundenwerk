// Writes the local Supabase URL and publishable key for the web app to
// apps/web/.env.local. `--stdout` prints the variables instead, e.g. for CI.
// Only public client values are emitted; secret keys are never written.
import { writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { runSupabase } from "./run-supabase.mjs";

const status = JSON.parse(runSupabase(["status", "--output", "json"]));
const variables = {
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
};

for (const [name, value] of Object.entries(variables)) {
  if (typeof value !== "string" || value === "") {
    console.error(`\`supabase status\` did not report a value for ${name}.`);
    process.exit(1);
  }
}

const content = Object.entries(variables)
  .map(([name, value]) => `${name}=${value}\n`)
  .join("");

if (process.argv.includes("--stdout")) {
  process.stdout.write(content);
} else {
  const target = fileURLToPath(
    new URL("../apps/web/.env.local", import.meta.url),
  );
  await writeFile(
    target,
    `# Local Supabase values from \`pnpm db:env\`. Not for hosted projects.\n${content}`,
  );
  console.log("Wrote apps/web/.env.local");
}
