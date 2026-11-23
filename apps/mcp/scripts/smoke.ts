/**
 * Starts the real server over stdio, as Claude Code or Claude Desktop would,
 * and walks through the drafting workflow as a fictional demo user against
 * the local Supabase stack. Prints a transcript of the tool calls.
 *
 *   pnpm --filter @urkundenwerk/mcp smoke
 */
import { strict as assert } from "node:assert";
import { existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { Client } from "@modelcontextprotocol/client";
import {
  getDefaultEnvironment,
  StdioClientTransport,
} from "@modelcontextprotocol/client/stdio";

const envFile = fileURLToPath(new URL("../../web/.env.local", import.meta.url));
if (!process.env.NEXT_PUBLIC_SUPABASE_URL && existsSync(envFile))
  process.loadEnvFile(envFile);

const client = new Client({ name: "urkundenwerk-smoke", version: "0.0.0" });
await client.connect(
  new StdioClientTransport({
    command: process.execPath,
    args: [
      fileURLToPath(
        new URL("../bin/urkundenwerk-mcp-server.mjs", import.meta.url),
      ),
    ],
    env: {
      ...getDefaultEnvironment(),
      NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY:
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
      // Fictional seed user; the password exists only in supabase/seed.sql.
      URKUNDENWERK_EMAIL: "erik.editor@demo.test",
      URKUNDENWERK_PASSWORD: "demo-password-123",
    },
    stderr: "inherit",
  }),
);

function summarise(value: unknown): string {
  return JSON.stringify(value, (key, entry) =>
    key === "blob" && typeof entry === "string"
      ? `<${entry.length} base64 chars>`
      : entry,
  );
}

async function call(name: string, args: Record<string, unknown> = {}) {
  console.log(`\n→ ${name} ${JSON.stringify(args)}`);
  const result = await client.callTool({ name, arguments: args });
  const content = result.content as {
    type: string;
    text?: string;
    resource?: unknown;
  }[];
  const text = content.find((block) => block.type === "text")?.text ?? "";
  const resource = content.find((block) => block.type === "resource");
  const shown = text.length > 600 ? `${text.slice(0, 600)}…` : text;
  console.log(`← ${result.isError ? "error" : "ok"}: ${shown}`);
  if (resource) console.log(`← resource: ${summarise(resource)}`);
  return {
    isError: result.isError === true,
    data: result.structuredContent as {
      document?: { documentId: string };
      completeness?: { ready: boolean };
    },
  };
}

const { tools } = await client.listTools();
console.log(`tools: ${tools.map((tool) => tool.name).join(", ")}`);

const today = new Date();
const twoDaysAgo = new Date(today.getTime() - 2 * 86_400_000)
  .toISOString()
  .slice(0, 10);

await call("urkundenwerk_list_firms");
const created = await call("urkundenwerk_create_draft", {
  data: {
    company: {
      name: "Smoketest Fahrradwerk GmbH",
      seat: "Musterstadt",
      purpose: "die Reparatur und den Handel mit Fahrrädern",
    },
    shareCapitalCents: 2_500_000,
  },
});
assert.equal(created.isError, false);
const documentId = created.data.document!.documentId;

await call("urkundenwerk_validate_document", { documentId });
const blocked = await call("urkundenwerk_export_document", {
  documentId,
  format: "pdf",
});
assert.equal(blocked.isError, true);

await call("urkundenwerk_update_draft", {
  documentId,
  patch: {
    notarisation: {
      deedNumber: "12/2026",
      date: twoDaysAgo,
      notaryName: "Dr. Nora Musterfrau",
      notarySeat: "Musterstadt",
    },
    founder: {
      salutation: "Frau",
      firstName: "Erika",
      lastName: "Beispiel",
      birthDate: "1988-06-01",
      address: {
        street: "Beispielweg 3",
        postalCode: "12345",
        city: "Musterstadt",
      },
    },
    contribution: "half",
  },
});
const validation = await call("urkundenwerk_validate_document", { documentId });
assert.equal(validation.data.completeness?.ready, true);
const exported = await call("urkundenwerk_export_document", {
  documentId,
  format: "pdf",
});
assert.equal(exported.isError, false);
await call("urkundenwerk_delete_draft", { documentId });

await client.close();
console.log("\nsmoke test passed");
