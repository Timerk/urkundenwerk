import {
  musterprotokollDraftSchema,
  musterprotokollMetadata,
  registerFilingMetadata,
  rulesFor,
} from "@urkundenwerk/core";
import { type CallToolResult, McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
import { documentTitleSchema } from "./domain";
import { RegisterFilingXmlError, ToolError } from "./errors";
import { AuthenticationError } from "./session";
import { StoreError } from "./store";
import * as tools from "./tools";

export const SERVER_NAME = "urkundenwerk-mcp-server";
export const SERVER_VERSION = "0.1.0";

const TEMPLATE = musterprotokollMetadata.id;
export const DRAFT_SCHEMA_URI = `urkundenwerk://templates/${TEMPLATE}/draft-schema`;
export const RULES_URI = `urkundenwerk://templates/${TEMPLATE}/rules`;

const INSTRUCTIONS = `Urkundenwerk drafts the statutory Musterprotokoll (Anlage 1 a) GmbHG) and the accompanying Handelsregisteranmeldung for a single-founder GmbH or UG.
You act as the signed-in user; Postgres row-level security decides what you can read and write, exactly as in the web app.
Workflow: urkundenwerk_list_firms -> urkundenwerk_create_draft (or urkundenwerk_list_documents) -> urkundenwerk_update_draft -> urkundenwerk_validate_document -> urkundenwerk_export_document.
You only provide structured data. The deed text is assembled deterministically from a versioned statutory template; never write or rephrase legal text yourself.
Amounts are whole cents (25.000 EUR = 2500000). Dates are ISO dates (YYYY-MM-DD). Do not invent personal data: ask the user for missing facts.`;

// ---------------------------------------------------------------------------
// Shared schemas
// ---------------------------------------------------------------------------

const documentId = z
  .uuid()
  .describe(
    "Document id from urkundenwerk_list_documents or urkundenwerk_create_draft",
  );

const tenant = z
  .string()
  .trim()
  .min(1)
  .max(63)
  .optional()
  .describe(
    "Firm slug (e.g. 'demo-kanzlei-nord') or tenant id from urkundenwerk_list_firms. Optional if you belong to one firm only.",
  );

const draftDescription = `Musterprotokoll draft data (camelCase keys, every field optional, unknown keys rejected).
Sections: notarisation {mode: in_person|video, deedNumber, date, notaryName, notarySeat}; founder {kind: natural_person|legal_entity, salutation: Herr|Frau|null, firstName, lastName, birthDate, address {street, postalCode, city}, name, registerCourt, registerNumber, seat, identificationDetails}; company {name (Firma incl. legal form, e.g. 'Muster GmbH' or 'Muster UG (haftungsbeschränkt)'), seat, purpose}; shareCapitalCents (integer cents); contribution: full|half; managingDirector {kind: founder|other, salutation, firstName, lastName, birthDate, residence}; notaryNotes.
For the Handelsregisteranmeldung, add filing {registerCourt (town of the Amtsgericht), businessAddress {street, postalCode, city}, paidCents (integer cents), fundsAtFreeDisposal, noDisqualification, instructedOnDisclosure, paymentEvidenceAttached (booleans)}.
Full JSON Schema: resource ${DRAFT_SCHEMA_URI}.`;

const documentTarget = z.enum(["musterprotokoll", "anmeldung"]);
const exportFormat = z.enum(["pdf", "docx", "xml"]);

const role = z.enum(["admin", "editor", "viewer"]);

const firmOutput = z.object({
  tenantId: z.string(),
  slug: z.string(),
  name: z.string(),
  role,
  canEdit: z.boolean(),
});

const completenessOutput = z.object({
  ready: z
    .boolean()
    .describe(
      "True when no rule reports an error, so the document can be exported",
    ),
  outstandingFields: z.number().int(),
  errors: z.number().int(),
  warnings: z.number().int(),
  notes: z.number().int(),
});

const summaryOutput = z.object({
  documentId: z.string(),
  title: z.string(),
  templateId: z.string(),
  templateVersion: z.string(),
  status: z.enum(["draft", "final"]),
  updatedAt: z.string(),
  completeness: completenessOutput.nullable(),
});

const documentOutput = z.object({
  document: summaryOutput.extend({
    firm: z
      .object({ tenantId: z.string(), slug: z.string(), name: z.string() })
      .nullable(),
    canEdit: z.boolean(),
    createdAt: z.string(),
    data: z.record(z.string(), z.unknown()),
  }),
});

const issueOutput = z.object({
  code: z
    .string()
    .describe("Stable rule code, e.g. field_required or gmbh_capital_minimum"),
  severity: z.enum(["error", "warning", "info"]),
  paths: z
    .array(z.string())
    .describe("Dot-separated draft paths, most relevant first"),
  message: z.string(),
  legalReference: z.string().nullable(),
});

// ---------------------------------------------------------------------------
// Results and errors
// ---------------------------------------------------------------------------

/** Compact JSON keeps tool results small in the agent's context. */
function json(value: unknown): string {
  return JSON.stringify(value);
}

function success(structured: Record<string, unknown>): CallToolResult {
  return {
    content: [{ type: "text", text: json(structured) }],
    structuredContent: structured,
  };
}

/** Writes a diagnostic to stderr; stdout carries the protocol. */
export type Logger = (message: string) => void;

function failure(error: unknown, log: Logger): CallToolResult {
  let text: string;
  if (error instanceof ToolError) {
    text = error.details
      ? `${error.message}\n${json(error.details)}`
      : error.message;
  } else if (error instanceof AuthenticationError) {
    text = error.message;
  } else if (error instanceof StoreError) {
    // Only the code: database messages can quote row values.
    log(`store error ${error.code ?? "unknown"}: ${error.message}`);
    text = `${error.message} The database reported error ${error.code ?? "unknown"}. Check that Supabase is reachable and try again.`;
  } else if (error instanceof RegisterFilingXmlError) {
    log(error.message);
    text =
      "An internal error prevented the XML export. Check the MCP server's stderr log.";
  } else {
    log(
      `unexpected ${error instanceof Error ? error.name : typeof error} in a tool call`,
    );
    text =
      "An unexpected error occurred. Try again; if it persists, check the MCP server's stderr log.";
  }
  return { isError: true, content: [{ type: "text", text }] };
}

export interface ServerDependencies {
  context: tools.ToolContext;
  /** Refreshes or renews the user's session before each tool call. */
  ensureSession?: () => Promise<void>;
  log?: Logger;
}

// ---------------------------------------------------------------------------
// Server factory
// ---------------------------------------------------------------------------

export function createServer(deps: ServerDependencies): McpServer {
  const { context } = deps;
  const log =
    deps.log ??
    ((message: string) => console.error(`[urkundenwerk-mcp] ${message}`));
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    { instructions: INSTRUCTIONS },
  );

  async function run(
    work: () => Promise<CallToolResult>,
  ): Promise<CallToolResult> {
    try {
      await deps.ensureSession?.();
      return await work();
    } catch (error) {
      return failure(error, log);
    }
  }

  const readOnly = {
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  };

  server.registerTool(
    "urkundenwerk_list_firms",
    {
      title: "List firms",
      description:
        "List the law firms (tenants) you belong to, with your role in each. Editors and admins can create and change drafts; viewers can read and export. Use a firm's slug as the `tenant` argument of other tools.",
      inputSchema: z.strictObject({}),
      outputSchema: z.object({ firms: z.array(firmOutput) }),
      annotations: readOnly,
    },
    () => run(async () => success(await tools.listFirms(context))),
  );

  server.registerTool(
    "urkundenwerk_list_documents",
    {
      title: "List documents",
      description:
        "List a firm's documents, most recently changed first, with title, template, status, last change, and Musterprotokoll completeness. Paginated: pass nextOffset as offset to continue. Use urkundenwerk_get_document for a document's data.",
      inputSchema: z.strictObject({
        tenant,
        limit: z
          .number()
          .int()
          .min(1)
          .max(100)
          .default(20)
          .describe("Maximum number of documents to return"),
        offset: z
          .number()
          .int()
          .min(0)
          .default(0)
          .describe("Number of documents to skip, for pagination"),
      }),
      outputSchema: z.object({
        firm: firmOutput,
        referenceDate: z.string(),
        total: z.number().int(),
        count: z.number().int(),
        offset: z.number().int(),
        hasMore: z.boolean(),
        nextOffset: z.number().int().optional(),
        documents: z.array(summaryOutput),
      }),
      annotations: readOnly,
    },
    (args) =>
      run(async () => success(await tools.listDocuments(context, args))),
  );

  server.registerTool(
    "urkundenwerk_get_document",
    {
      title: "Get document",
      description:
        "Get one document: its draft data including the optional filing section, firm, edit rights, and Musterprotokoll completeness. Use urkundenwerk_validate_document for the individual rule findings.",
      inputSchema: z.strictObject({ documentId }),
      outputSchema: documentOutput,
      annotations: readOnly,
    },
    (args) => run(async () => success(await tools.getDocument(context, args))),
  );

  server.registerTool(
    "urkundenwerk_create_draft",
    {
      title: "Create Musterprotokoll draft",
      description: `Create a new Musterprotokoll draft (single founder) in a firm, optionally with initial data including its filing section. Requires the editor or admin role. Incomplete data is fine; the draft is validated against the draft schema, not yet against the rules. Defaults: in-person notarisation, a natural person as founder, the founder as managing director.
You supply structured data only; the deed text is generated deterministically from the statutory template, never by you.
Example: {"tenant": "demo-kanzlei-nord", "data": {"company": {"name": "Beispiel Bau GmbH", "seat": "Musterstadt"}, "shareCapitalCents": 2500000}}`,
      inputSchema: z.strictObject({
        tenant,
        title: documentTitleSchema
          .optional()
          .describe("Document title; defaults to the Firma (company.name)"),
        data: musterprotokollDraftSchema.optional().describe(draftDescription),
      }),
      outputSchema: documentOutput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    (args) => run(async () => success(await tools.createDraft(context, args))),
  );

  server.registerTool(
    "urkundenwerk_update_draft",
    {
      title: "Update Musterprotokoll draft",
      description: `Change a draft by deep-merging a partial patch into the stored data: nested objects merge key by key, other values replace the old ones, and null is a value (salutation: null means no salutation). Remove fields with \`unset\`. The result is validated with the draft schema before it is saved. Requires the editor or admin role.
Use patch.filing to add or update Handelsregisteranmeldung fields. Only structured data changes; legal text is never edited directly.
Example: {"documentId": "…", "patch": {"founder": {"birthDate": "1985-04-12"}, "contribution": "full"}, "unset": ["notaryNotes"]}`,
      inputSchema: z.strictObject({
        documentId,
        patch: musterprotokollDraftSchema.optional().describe(draftDescription),
        unset: z
          .array(
            z.string().regex(/^[A-Za-z]+(\.[A-Za-z]+)*$/, {
              error: "Use dot-separated field paths",
            }),
          )
          .max(50)
          .optional()
          .describe(
            "Dot-separated paths to remove after merging, e.g. ['founder.address.street', 'notaryNotes']",
          ),
        title: documentTitleSchema.optional().describe("New document title"),
      }),
      outputSchema: documentOutput,
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    (args) => run(async () => success(await tools.updateDraft(context, args))),
  );

  server.registerTool(
    "urkundenwerk_validate_document",
    {
      title: "Validate document",
      description:
        "Run Urkundenwerk's deterministic rule engine with today's date in Germany as reference date. Validate the Musterprotokoll by default, or pass document: 'anmeldung' to check both the deed and the filing. Returns issues with code, severity, field paths, message, and legal reference. Only errors block export.",
      inputSchema: z.strictObject({
        documentId,
        document: documentTarget.default("musterprotokoll"),
      }),
      outputSchema: z.object({
        documentId: z.string(),
        referenceDate: z.string(),
        completeness: completenessOutput,
        issues: z.array(issueOutput),
      }),
      annotations: readOnly,
    },
    (args) =>
      run(async () => success(await tools.validateDocument(context, args))),
  );

  server.registerTool(
    "urkundenwerk_export_document",
    {
      title: "Export document",
      description: `Export the Musterprotokoll or Handelsregisteranmeldung as PDF or DOCX, or export the register filing data as XSD-validated XML. Only works when the selected document's rules report no error. Filing exports check both the deed and filing rules.
Returns the file as an embedded resource (base64, with its MIME type) and a suggested filename. With saveTo, the server also writes the file below its configured export directory (URKUNDENWERK_EXPORT_DIR). Set overwrite only to replace an existing file.`,
      inputSchema: z.strictObject({
        documentId,
        format: exportFormat.default("pdf").describe("File format"),
        document: documentTarget
          .optional()
          .describe(
            "Defaults to musterprotokoll for PDF and DOCX. XML requires anmeldung, which is implicit when omitted.",
          ),
        saveTo: z
          .string()
          .trim()
          .min(1)
          .max(200)
          .optional()
          .describe(
            "Directory relative to the server's export directory, e.g. '.' or 'nord/2026'. Omit to only embed the file.",
          ),
        overwrite: z
          .boolean()
          .default(false)
          .describe("Replace an existing file when saving"),
      }),
      outputSchema: z.object({
        documentId: z.string(),
        title: z.string(),
        format: exportFormat,
        filename: z.string(),
        mimeType: z.string(),
        sizeBytes: z.number().int(),
        resourceUri: z.string(),
        savedTo: z.string().nullable(),
        issues: z
          .array(issueOutput)
          .describe("Warnings and notes that do not block the export"),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: false,
        openWorldHint: false,
      },
    },
    (args) =>
      run(async () => {
        const { result, bytes } = await tools.exportDocument(context, args);
        return {
          content: [
            { type: "text", text: json(result) },
            {
              type: "resource",
              resource: {
                uri: result.resourceUri,
                mimeType: result.mimeType,
                blob: Buffer.from(bytes).toString("base64"),
              },
            },
          ],
          structuredContent: result,
        };
      }),
  );

  server.registerTool(
    "urkundenwerk_delete_draft",
    {
      title: "Delete document",
      description:
        "Permanently delete a document and its draft data. Requires the editor or admin role. This cannot be undone; confirm with the user first.",
      inputSchema: z.strictObject({ documentId }),
      outputSchema: z.object({
        deleted: z.literal(true),
        documentId: z.string(),
        title: z.string(),
      }),
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        idempotentHint: true,
        openWorldHint: false,
      },
    },
    (args) => run(async () => success(await tools.deleteDraft(context, args))),
  );

  // -------------------------------------------------------------------------
  // Resources and prompts
  // -------------------------------------------------------------------------

  server.registerResource(
    "musterprotokoll-draft-schema",
    DRAFT_SCHEMA_URI,
    {
      title: "Musterprotokoll draft schema",
      description:
        "JSON Schema of the draft data, including the optional filing section, accepted by urkundenwerk_create_draft and urkundenwerk_update_draft",
      mimeType: "application/schema+json",
    },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/schema+json",
          text: JSON.stringify(
            z.toJSONSchema(musterprotokollDraftSchema),
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerResource(
    "musterprotokoll-rules",
    RULES_URI,
    {
      title: "Musterprotokoll and Handelsregisteranmeldung rules",
      description:
        "The rules urkundenwerk_validate_document runs for each document target: code, severity, legal reference, and summary",
      mimeType: "application/json",
    },
    (uri) => ({
      contents: [
        {
          uri: uri.href,
          mimeType: "application/json",
          text: JSON.stringify(
            {
              templateId: musterprotokollMetadata.id,
              templateVersion: musterprotokollMetadata.version,
              legalBasis: musterprotokollMetadata.legalBasis,
              rules: rulesFor(registerFilingMetadata.id).map((rule) => ({
                templateId: rule.templateId,
                code: rule.id,
                severity: rule.severity,
                legalReference: rule.legalReference,
                summary: rule.summary,
                paths: rule.paths,
              })),
            },
            null,
            2,
          ),
        },
      ],
    }),
  );

  server.registerPrompt(
    "prepare_musterprotokoll",
    {
      title: "Prepare a Musterprotokoll from facts",
      description:
        "Turn facts about a single-founder GmbH or UG into a validated Musterprotokoll draft",
      argsSchema: z.object({
        facts: z
          .string()
          .min(1)
          .max(4000)
          .describe("The facts of the formation, in any language"),
        tenant: z
          .string()
          .optional()
          .describe("Firm slug, if you belong to several firms"),
      }),
    },
    ({ facts, tenant: firm }) => ({
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Prepare a Musterprotokoll draft in Urkundenwerk from the facts below.

1. ${firm ? `Work in the firm "${firm}".` : "Call urkundenwerk_list_firms and pick the firm; ask me if there are several."}
2. Map the facts to the draft fields (see the ${DRAFT_SCHEMA_URI} resource). Amounts in whole cents, dates as YYYY-MM-DD. Leave out anything the facts do not state; do not invent names, dates, or addresses.
3. Create the draft with urkundenwerk_create_draft, then call urkundenwerk_validate_document.
4. Report the remaining issues with their legal references and ask me for the missing facts. Apply my answers with urkundenwerk_update_draft and validate again.
5. Export only when I ask for it.

Do not write or rephrase legal text: Urkundenwerk assembles the deed from the statutory template.

Facts:
${facts}`,
          },
        },
      ],
    }),
  );

  return server;
}
