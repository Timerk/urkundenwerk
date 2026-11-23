# Urkundenwerk MCP server

`@urkundenwerk/mcp` exposes Urkundenwerk's drafting workflow over the
[Model Context Protocol](https://modelcontextprotocol.io), so an AI agent
such as Claude Code or Claude Desktop can create a Musterprotokoll draft,
fill it in, run the rule checks, and export the deed or the accompanying
Handelsregisteranmeldung as PDF or DOCX. The filing data can also be
exported as XSD-validated XML.

The agent supplies structured data only. The deed text is assembled
deterministically from the versioned statutory template in
`@urkundenwerk/core` and rendered by `@urkundenwerk/render`, the same
pipeline as the web app's export
([ADR-0002](../../docs/adr/0002-deterministic-legal-text.md)). No tool
generates or edits legal text, and validation involves no LLM.

> **Demonstration project. Not legal advice.** Use the fictional demo data.

## Security model

- **The user's own session.** The server signs in to Supabase Auth with one
  user's email and password and sends that user's JWT with every query.
  Postgres row-level security decides which firms and documents exist for
  the agent and which writes succeed, exactly as in the browser
  ([ADR-0003](../../docs/adr/0003-tenancy-with-row-level-security.md),
  [ADR-0011](../../docs/adr/0011-mcp-server-with-user-session.md)).
- **No secret key.** Only the publishable key is accepted. `sb_secret_…`
  and service-role keys bypass RLS, so the server refuses to start with one.
- **Roles.** Viewers can list, read, validate, and export. Creating,
  changing, and deleting drafts needs the editor or admin role. The server
  checks the role to explain a refusal, and RLS enforces it regardless.
- **Firms.** Tools that work in a firm take an optional `tenant` (slug or
  id). Without it, the server uses your only firm or asks you to choose.
  Documents of other firms do not exist for you.
- **stdout is the protocol.** Diagnostics go to stderr and never contain
  credentials or document data; database errors are logged by code only.
- **Files.** Exports are embedded in the tool result. Writing to disk is off
  unless `URKUNDENWERK_EXPORT_DIR` names an absolute directory; `saveTo` is
  then relative to it, and paths that leave it are refused.

The password stays in your MCP client's configuration and in the server's
memory. Use the fictional demo users or your own local account, never a
shared one.

## Setup against the local demo

From the repository root, start the local stack and print its URL and
publishable key:

```sh
pnpm install --frozen-lockfile
pnpm db:start
pnpm --silent db:env --stdout
```

The server is started with Node.js 24 from
`apps/mcp/bin/urkundenwerk-mcp-server.mjs`; it loads the workspace's
TypeScript sources through `tsx`, so there is no build step.

| Variable                               | Required | Meaning                                                                                            |
| -------------------------------------- | -------- | -------------------------------------------------------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`             | yes      | Supabase API URL, `http://127.0.0.1:54321` locally                                                 |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes      | Publishable key (`sb_publishable_…`) from `pnpm db:env`                                            |
| `URKUNDENWERK_EMAIL`                   | yes      | The user the agent acts as, e.g. `erik.editor@demo.test`                                           |
| `URKUNDENWERK_PASSWORD`                | yes      | That user's password; the demo password is in the [root README](../../README.md#local-development) |
| `URKUNDENWERK_EXPORT_DIR`              | no       | Absolute directory that `urkundenwerk_export_document` may write to                                |

### Claude Code

```sh
claude mcp add urkundenwerk \
  -e NEXT_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 \
  -e NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<publishable key> \
  -e URKUNDENWERK_EMAIL=erik.editor@demo.test \
  -e URKUNDENWERK_PASSWORD=<demo password> \
  -- node /path/to/urkundenwerk/apps/mcp/bin/urkundenwerk-mcp-server.mjs
```

Run `claude mcp list` to check that it connects, then ask Claude to work
with Urkundenwerk. `/mcp` in a session shows the tools.

### Claude Desktop

Add the server to `claude_desktop_config.json` (Settings → Developer → Edit
Config) and restart Claude Desktop:

```json
{
  "mcpServers": {
    "urkundenwerk": {
      "command": "node",
      "args": [
        "/path/to/urkundenwerk/apps/mcp/bin/urkundenwerk-mcp-server.mjs"
      ],
      "env": {
        "NEXT_PUBLIC_SUPABASE_URL": "http://127.0.0.1:54321",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": "<publishable key>",
        "URKUNDENWERK_EMAIL": "<demo user email>",
        "URKUNDENWERK_PASSWORD": "<demo password>",
        "URKUNDENWERK_EXPORT_DIR": "/path/to/exports"
      }
    }
  }
}
```

On Windows, use a path such as `C:\\path\\to\\urkundenwerk\\apps\\mcp\\bin\\urkundenwerk-mcp-server.mjs`.

## Example conversation

With the server signed in as `erik.editor@demo.test`:

> **You:** Prepare a Musterprotokoll for Fahrradwerk Beispiel GmbH in
> Musterstadt, 25.000 € share capital paid in full, purpose: repairing and
> selling bicycles.
>
> **Claude** calls `urkundenwerk_list_firms` (one firm: Demo-Kanzlei Nord,
> editor), then `urkundenwerk_create_draft` with the company, the capital
> `2500000` cents, and `contribution: "full"`, then
> `urkundenwerk_validate_document`.
>
> **Claude:** I created the draft "Fahrradwerk Beispiel GmbH". Seven fields
> are still required before it can be exported, all about the founder:
> salutation, first and last name, date of birth, and street, postal code,
> and city (§ 2 Abs. 1a GmbHG, Anlage 1 a) GmbHG). The notary's details can
> stay blank for the notary to fill in. Who is the founder?
>
> **You:** Max Beispiel, born 12 April 1985, Beispielweg 3, 12345
> Musterstadt. Notarised two days ago by Dr. Nora Musterfrau in Musterstadt
> under deed number 7/2026.
>
> **Claude** calls `urkundenwerk_update_draft` with those values and
> validates again: no errors. On request, it calls
> `urkundenwerk_export_document` with `format: "pdf"` and returns
> `Musterprotokoll-Fahrradwerk-Beispiel-GmbH.pdf`.

The `prepare_musterprotokoll` prompt starts the same workflow from a block
of facts.

To prepare the Handelsregisteranmeldung for the same draft, call
`urkundenwerk_update_draft` with the document ID and the filing facts:

```json
{
  "documentId": "00000000-0000-4000-8000-000000000001",
  "patch": {
    "filing": {
      "registerCourt": "Musterstadt",
      "businessAddress": {
        "street": "Beispielweg 3",
        "postalCode": "12345",
        "city": "Musterstadt"
      },
      "paidCents": 2500000,
      "fundsAtFreeDisposal": true,
      "noDisqualification": true,
      "instructedOnDisclosure": true
    }
  }
}
```

Set the assurances to `true` only after the user confirms them. Call
`urkundenwerk_validate_document` with `document: "anmeldung"` to check the
deed and the filing. When it reports no errors, call
`urkundenwerk_export_document` with `format: "xml"` for the register data or
`document: "anmeldung", format: "pdf"` for the filing PDF.

## Tool reference

All tools return JSON as text and as structured content that matches their
output schema. Errors come back as tool results with `isError: true` and say
how to recover. Amounts are integer cents; dates are ISO dates.

| Tool                             | Annotations                 | What it does                                                                                                                                                                            |
| -------------------------------- | --------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `urkundenwerk_list_firms`        | read-only                   | Your firms with slug, name, role, and whether you can edit.                                                                                                                             |
| `urkundenwerk_list_documents`    | read-only                   | A firm's documents with title, template, status, last change, and Musterprotokoll completeness. `tenant`, `limit` (≤ 100), `offset`.                                                    |
| `urkundenwerk_get_document`      | read-only                   | One document's draft data including optional `filing`, firm, edit right, and Musterprotokoll completeness. `documentId`.                                                                |
| `urkundenwerk_create_draft`      | write                       | A new Musterprotokoll draft with the builder's defaults. `tenant`, `title` (defaults to the Firma), `data` (partial draft including optional `filing`).                                 |
| `urkundenwerk_update_draft`      | write, idempotent           | Deep-merges `patch` (including optional `filing`), removes `unset` paths, and renames with `title`. Validates before saving.                                                            |
| `urkundenwerk_validate_document` | read-only                   | Checks the Musterprotokoll by default. Pass `document: "anmeldung"` to include both the deed and filing rules. Returns issues with code, severity, paths, message, and legal reference. |
| `urkundenwerk_export_document`   | write (disk), may overwrite | PDF, DOCX, or XSD-validated XML as an embedded base64 resource with MIME type and filename. `format`, `document`, `saveTo`, `overwrite`.                                                |
| `urkundenwerk_delete_draft`      | destructive, idempotent     | Deletes a document permanently. `documentId`.                                                                                                                                           |

Merge semantics of `urkundenwerk_update_draft`: nested objects merge key by
key; any other value replaces the stored one, and `null` is a value
(`salutation: null` means no salutation). The update applies only if the
document has not changed since it was read, so a concurrent save in the web
app is reported instead of overwritten.

For PDF and DOCX exports, `document` defaults to `"musterprotokoll"` and
can be set to `"anmeldung"`. XML always exports the filing (`application/xml`).
Errors for the selected document block export. An Anmeldung export requires
both sets of rules to pass.

Resources:

- `urkundenwerk://templates/musterprotokoll-einpersonen/draft-schema`: the
  JSON Schema of the draft data including the optional `filing` section.
- `urkundenwerk://templates/musterprotokoll-einpersonen/rules`: every rule
  with its template, code, severity, legal reference, and summary.

Prompt: `prepare_musterprotokoll` (`facts`, optional `tenant`).

## Development

| Command                                                                             | Purpose                                                           |
| ----------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `pnpm --filter @urkundenwerk/mcp test`                                              | Unit tests of the tools against a fake store                      |
| `pnpm --filter @urkundenwerk/mcp test:integration`                                  | The tools over the in-memory MCP transport against local Supabase |
| `pnpm --filter @urkundenwerk/mcp smoke`                                             | Starts the server over stdio and walks through the workflow       |
| `npx @modelcontextprotocol/inspector node apps/mcp/bin/urkundenwerk-mcp-server.mjs` | Explore the tools interactively                                   |

The integration tests and the smoke run sign in as the seeded demo users
and read the local URL and key from `apps/web/.env.local` (`pnpm db:env`)
unless the variables are set. They delete the drafts they create.

[`evaluation/urkundenwerk.xml`](evaluation/urkundenwerk.xml) holds twelve
read-only questions with verified answers for evaluating how well an agent
uses the tools. Run them against a freshly reset database
(`pnpm db:reset`) with the server signed in as `mia.multi@demo.test`, for
example with the mcp-builder evaluation harness.
