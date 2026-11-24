import "server-only";
import {
  type Issue,
  type MusterprotokollDraft,
  musterprotokollDraftSchema,
  musterprotokollMetadata,
  musterprotokollTemplate,
  registerFilingTemplate,
  type RuleCode,
  type RuleContext,
  validateRegisterFiling,
} from "@urkundenwerk/core";
import {
  buildRegisterFilingXml,
  validateRegisterFilingXml,
} from "@urkundenwerk/core/register-filing-xml";
import { renderDocx, renderPdf } from "@urkundenwerk/render";
import type { z } from "zod";
import { recordExport } from "../audit/record";
import { type AppSupabaseClient, getDocument } from "./repository";
import {
  documentIdSchema,
  type ExportDocument,
  type ExportFormat,
  exportDocumentSchema,
  exportFormatSchema,
} from "./schemas";

const CONTENT_TYPES: Record<ExportFormat, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xml: "application/xml; charset=utf-8",
};

const RENDERERS = { pdf: renderPdf, docx: renderDocx } as const;

/** A problem reported to the client with its stable code. */
export type ExportIssue = {
  path: string;
  code: string;
  message: string;
};

/** Stored data that is not even a draft: Zod issue codes. */
function draftIssues(error: z.ZodError): ExportIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    code: issue.code,
    message: issue.message,
  }));
}

/** Words a rule issue for the client, e.g. in the request's UI language. */
export type DescribeIssue = (issue: Issue<RuleCode>) => string;

/** Errors from the rule engine: stable rule codes such as `field_required`. */
function ruleErrors(
  issues: readonly Issue<RuleCode>[],
  describe: DescribeIssue,
): ExportIssue[] {
  return issues
    .filter((issue) => issue.severity === "error")
    .map((issue) => ({
      path: issue.paths[0] ?? "",
      code: issue.code,
      message: describe(issue),
    }));
}

function problem(
  status: number,
  error: string,
  extra: Record<string, unknown> = {},
): Response {
  return Response.json(
    { error, ...extra },
    { status, headers: { "Cache-Control": "no-store" } },
  );
}

const TRANSLITERATIONS: Record<string, string> = {
  ä: "ae",
  ö: "oe",
  ü: "ue",
  Ä: "Ae",
  Ö: "Oe",
  Ü: "Ue",
  ß: "ss",
};

/** Builds an ASCII-only filename that is safe in a quoted header value. */
export function exportFilename(
  title: string,
  format: ExportFormat,
  document: ExportDocument = format === "xml" ? "anmeldung" : "musterprotokoll",
): string {
  const base = title
    .replace(/[äöüÄÖÜß]/g, (char) => TRANSLITERATIONS[char] ?? "")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
  const prefix =
    document === "anmeldung" ? "Handelsregisteranmeldung" : "Musterprotokoll";
  return `${prefix}${base ? `-${base}` : ""}.${format}`;
}

/**
 * Exports a deed or a filing. The document is loaded with the caller's
 * client, so row-level security decides whether it exists for them, and
 * every successful export is recorded in the audit log before it is
 * returned.
 */
export async function exportDocument(
  supabase: AppSupabaseClient,
  userId: string | null,
  params: {
    id: string;
    format: string | null;
    document?: string | null;
    referenceDate: string;
    generatedAt?: string;
    /** Defaults to core's English diagnostic message. */
    describe?: DescribeIssue;
  },
): Promise<Response> {
  const describe = params.describe ?? ((issue) => issue.message);
  if (!userId) return problem(401, "unauthenticated");

  const format = exportFormatSchema.safeParse(params.format);
  if (!format.success) {
    return problem(400, "unsupported_format", {
      supported: exportFormatSchema.options,
    });
  }
  const target = exportDocumentSchema.safeParse(
    params.document ??
      (format.data === "xml" ? "anmeldung" : "musterprotokoll"),
  );
  if (
    !target.success ||
    (format.data === "xml" && target.data !== "anmeldung")
  ) {
    return problem(400, "unsupported_document");
  }

  const id = documentIdSchema.safeParse(params.id);
  if (!id.success) return problem(404, "not_found");

  const document = await getDocument(supabase, id.data);
  if (!document) return problem(404, "not_found");

  if (
    document.template_id !== musterprotokollMetadata.id ||
    document.template_version !== musterprotokollMetadata.version
  ) {
    return problem(409, "unsupported_template", {
      templateId: document.template_id,
      templateVersion: document.template_version,
    });
  }

  const draft = musterprotokollDraftSchema.safeParse(document.data);
  if (!draft.success) {
    return problem(422, "invalid_draft", {
      issues: draftIssues(draft.error),
    });
  }

  const response = await render(
    draft.data,
    document.title,
    format.data,
    target.data,
    params,
    describe,
  );
  if (response.status !== 200) return response;
  // An export that cannot be accounted for is not handed out.
  if (!(await recordExport(supabase, document.id, format.data, target.data))) {
    return problem(500, "audit_failed");
  }
  return response;
}

async function render(
  draft: MusterprotokollDraft,
  title: string,
  format: ExportFormat,
  target: ExportDocument,
  params: { referenceDate: string; generatedAt?: string },
  describe: DescribeIssue,
): Promise<Response> {
  // The same rules as in the builder decide; warnings do not block.
  const context = { referenceDate: params.referenceDate };
  if (format === "xml") {
    return exportXml(
      draft,
      context,
      title,
      params.generatedAt ?? new Date().toISOString(),
      describe,
    );
  }
  const template =
    target === "anmeldung" ? registerFilingTemplate : musterprotokollTemplate;
  const result = template.validate(draft, context);
  if (!result.success) {
    return problem(422, "incomplete", {
      issues: ruleErrors(result.issues, describe),
    });
  }

  const model =
    target === "anmeldung"
      ? registerFilingTemplate.build(draft, context)
      : musterprotokollTemplate.build(result.data, context);
  const bytes = await RENDERERS[format](model);
  return download(bytes, title, target, format);
}

async function exportXml(
  draft: MusterprotokollDraft,
  context: RuleContext,
  title: string,
  generatedAt: string,
  describe: DescribeIssue,
) {
  const result = validateRegisterFiling(draft, context);
  if (!result.success) {
    return problem(422, "incomplete", {
      issues: ruleErrors(result.issues, describe),
    });
  }
  try {
    const xml = buildRegisterFilingXml(result.data, { generatedAt });
    if (await validateRegisterFilingXml(xml)) {
      return download(new TextEncoder().encode(xml), title, "anmeldung", "xml");
    }
  } catch {
    // The generator or validator may include personal data in diagnostics.
  }
  console.error("[export] Register filing XML generation or validation failed");
  return problem(500, "xml_export_failed");
}

function download(
  bytes: Uint8Array,
  title: string,
  target: ExportDocument,
  format: ExportFormat,
): Response {
  return new Response(new Blob([new Uint8Array(bytes)]), {
    status: 200,
    headers: {
      "Content-Type": CONTENT_TYPES[format],
      "Content-Disposition": `attachment; filename="${exportFilename(title, format, target)}"`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
