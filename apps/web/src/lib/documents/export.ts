import "server-only";
import {
  buildMusterprotokoll,
  type MusterprotokollIssue,
  musterprotokollDraftSchema,
  musterprotokollMetadata,
  validateMusterprotokoll,
} from "@urkundenwerk/core";
import { renderDocx, renderPdf } from "@urkundenwerk/render";
import type { z } from "zod";
import { type AppSupabaseClient, getDocument } from "./repository";
import {
  documentIdSchema,
  type ExportFormat,
  exportFormatSchema,
} from "./schemas";

const CONTENT_TYPES: Record<ExportFormat, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
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
function ruleErrors(issues: readonly MusterprotokollIssue[]): ExportIssue[] {
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
export function exportFilename(title: string, format: ExportFormat): string {
  const base = title
    .replace(/[äöüÄÖÜß]/g, (char) => TRANSLITERATIONS[char] ?? "")
    .normalize("NFKD")
    .replace(/\p{M}+/gu, "")
    .replace(/[^A-Za-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/, "");
  return `Musterprotokoll${base ? `-${base}` : ""}.${format}`;
}

/**
 * Exports a document as PDF or DOCX. The document is loaded with the caller's
 * client, so row-level security decides whether it exists for them.
 */
export async function exportDocument(
  supabase: AppSupabaseClient,
  userId: string | null,
  params: { id: string; format: string | null; referenceDate: string },
): Promise<Response> {
  if (!userId) return problem(401, "unauthenticated");

  const format = exportFormatSchema.safeParse(params.format);
  if (!format.success) {
    return problem(400, "unsupported_format", {
      supported: exportFormatSchema.options,
    });
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
  const result = validateMusterprotokoll(draft.data, context);
  if (!result.success) {
    return problem(422, "incomplete", { issues: ruleErrors(result.issues) });
  }

  const model = buildMusterprotokoll(result.data, context);
  const bytes = await RENDERERS[format.data](model);

  return new Response(new Blob([new Uint8Array(bytes)]), {
    status: 200,
    headers: {
      "Content-Type": CONTENT_TYPES[format.data],
      "Content-Disposition": `attachment; filename="${exportFilename(document.title, format.data)}"`,
      "Content-Length": String(bytes.byteLength),
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
