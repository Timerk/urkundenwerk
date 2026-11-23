import "server-only";
import {
  type Issue,
  type MusterprotokollDraft,
  musterprotokollDraftSchema,
  musterprotokollMetadata,
  musterprotokollTemplate,
  registerFilingTemplate,
  type RuleContext,
  validateRegisterFiling,
} from "@urkundenwerk/core";
import {
  buildRegisterFilingXml,
  validateRegisterFilingXml,
} from "@urkundenwerk/core/register-filing-xml";
import { renderDocx, renderPdf } from "@urkundenwerk/render";
import type { z } from "zod";
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

/** Errors from the rule engine: stable rule codes such as `field_required`. */
function ruleErrors(issues: readonly Issue[]): ExportIssue[] {
  return issues
    .filter((issue) => issue.severity === "error")
    .map((issue) => ({
      path: issue.paths[0] ?? "",
      code: issue.code,
      message: issue.message,
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
 * client, so row-level security decides whether it exists for them.
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
  },
): Promise<Response> {
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

  // The same rules as in the builder decide; warnings do not block.
  const context = { referenceDate: params.referenceDate };
  if (format.data === "xml") {
    return exportXml(
      draft.data,
      context,
      document.title,
      params.generatedAt ?? new Date().toISOString(),
    );
  }
  const template =
    target.data === "anmeldung"
      ? registerFilingTemplate
      : musterprotokollTemplate;
  const result = template.validate(draft.data, context);
  if (!result.success) {
    return problem(422, "incomplete", { issues: ruleErrors(result.issues) });
  }

  const model =
    target.data === "anmeldung"
      ? registerFilingTemplate.build(draft.data, context)
      : musterprotokollTemplate.build(result.data, context);
  const bytes = await RENDERERS[format.data](model);
  return download(bytes, document.title, target.data, format.data);
}

async function exportXml(
  draft: MusterprotokollDraft,
  context: RuleContext,
  title: string,
  generatedAt: string,
) {
  const result = validateRegisterFiling(draft, context);
  if (!result.success) {
    return problem(422, "incomplete", { issues: ruleErrors(result.issues) });
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
