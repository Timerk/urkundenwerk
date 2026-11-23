import {
  buildMusterprotokoll,
  buildRegisterFiling,
  type MusterprotokollDraft,
  musterprotokollMetadata,
  type RegisterFilingData,
  type RegisterFilingIssue,
  validateMusterprotokoll,
  validateRegisterFiling,
} from "@urkundenwerk/core";
import {
  buildRegisterFilingXml,
  validateRegisterFilingXml,
} from "@urkundenwerk/core/register-filing-xml";
import { renderDocx, renderPdf } from "@urkundenwerk/render";
import {
  assertSupportedTemplate,
  canEditDocuments,
  checkDraft,
  type Completeness,
  completenessOf,
  DEFAULT_DOCUMENT_TITLE,
  type ExportDocument,
  exportFilename,
  type ExportFormat,
  membershipFor,
  mergeDraft,
  parseDraft,
  type ReportedIssue,
  reportIssues,
  resolveTenant,
  storedDraft,
  unsetPath,
  withDefaults,
} from "./domain";
import { RegisterFilingXmlError, ToolError } from "./errors";
import { writeExport } from "./output";
import type { DocumentStore, Membership, StoredDocument } from "./store";

/*
 * Tool handlers, independent of the MCP transport so they can be tested with
 * a fake store. None of them writes or changes legal text: they move
 * structured data through the deterministic pipeline in core (ADR-0002).
 */

export interface ToolContext {
  store: DocumentStore;
  /** The rules' reference date: today in Germany. */
  today(): string;
  /** Root directory for exports saved to disk; saving is off without it. */
  exportDir: string | undefined;
}

const CONTENT_TYPES: Record<ExportFormat, string> = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xml: "application/xml",
};

const RENDERERS = { pdf: renderPdf, docx: renderDocx } as const;

// ---------------------------------------------------------------------------
// Shapes returned to the agent
// ---------------------------------------------------------------------------

export type FirmView = {
  tenantId: string;
  slug: string;
  name: string;
  role: Membership["role"];
  canEdit: boolean;
};

export type DocumentSummaryView = {
  documentId: string;
  title: string;
  templateId: string;
  templateVersion: string;
  status: StoredDocument["status"];
  updatedAt: string;
  /** `null` for documents these tools cannot check yet. */
  completeness: Completeness | null;
};

export type DocumentView = DocumentSummaryView & {
  firm: { tenantId: string; slug: string; name: string } | null;
  canEdit: boolean;
  createdAt: string;
  data: MusterprotokollDraft;
};

function firmView(membership: Membership): FirmView {
  return {
    tenantId: membership.tenantId,
    slug: membership.slug,
    name: membership.name,
    role: membership.role,
    canEdit: canEditDocuments(membership.role),
  };
}

function notFound(documentId: string): ToolError {
  return new ToolError(
    `Document ${documentId} was not found, or you are not a member of its firm. Use urkundenwerk_list_documents to find document ids.`,
  );
}

function roleError(
  membership: Membership | undefined,
  action: string,
): ToolError {
  return new ToolError(
    membership
      ? `Your role in ${membership.name} is ${membership.role}, which does not allow ${action}. Only editors and admins can do that; ask an admin of the firm.`
      : `You are not allowed to ${action} here.`,
  );
}

function summaryOf(
  document: StoredDocument,
  referenceDate: string,
): DocumentSummaryView {
  let completeness: Completeness | null = null;
  try {
    completeness = completenessOf(
      checkDraft(storedDraft(document), referenceDate),
    );
  } catch (error) {
    if (!(error instanceof ToolError)) throw error;
  }
  return {
    documentId: document.id,
    title: document.title,
    templateId: document.templateId,
    templateVersion: document.templateVersion,
    status: document.status,
    updatedAt: document.updatedAt,
    completeness,
  };
}

function documentView(
  document: StoredDocument,
  membership: Membership | undefined,
  referenceDate: string,
): DocumentView {
  const data = storedDraft(document);
  return {
    ...summaryOf(document, referenceDate),
    firm: membership
      ? {
          tenantId: membership.tenantId,
          slug: membership.slug,
          name: membership.name,
        }
      : null,
    canEdit: membership ? canEditDocuments(membership.role) : false,
    createdAt: document.createdAt,
    data,
  };
}

async function loadDocument(ctx: ToolContext, documentId: string) {
  const [document, memberships] = await Promise.all([
    ctx.store.getDocument(documentId),
    ctx.store.listMemberships(),
  ]);
  if (!document) throw notFound(documentId);
  return {
    document,
    membership: membershipFor(memberships, document.tenantId),
  };
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export async function listFirms(ctx: ToolContext) {
  const memberships = await ctx.store.listMemberships();
  return { firms: memberships.map(firmView) };
}

export async function listDocuments(
  ctx: ToolContext,
  args: { tenant?: string; limit: number; offset: number },
) {
  const membership = resolveTenant(
    await ctx.store.listMemberships(),
    args.tenant,
  );
  const page = await ctx.store.listDocuments(membership.tenantId, {
    limit: args.limit,
    offset: args.offset,
  });
  const referenceDate = ctx.today();
  const nextOffset = args.offset + page.documents.length;
  const hasMore = page.total > nextOffset;
  return {
    firm: firmView(membership),
    referenceDate,
    total: page.total,
    count: page.documents.length,
    offset: args.offset,
    hasMore,
    ...(hasMore ? { nextOffset } : {}),
    documents: page.documents.map((document) =>
      summaryOf(document, referenceDate),
    ),
  };
}

export async function getDocument(
  ctx: ToolContext,
  args: { documentId: string },
): Promise<{ document: DocumentView }> {
  const { document, membership } = await loadDocument(ctx, args.documentId);
  return { document: documentView(document, membership, ctx.today()) };
}

export async function createDraft(
  ctx: ToolContext,
  args: { tenant?: string; title?: string; data?: MusterprotokollDraft },
): Promise<{ document: DocumentView }> {
  const membership = resolveTenant(
    await ctx.store.listMemberships(),
    args.tenant,
  );
  if (!canEditDocuments(membership.role)) {
    throw roleError(membership, "creating documents");
  }
  const data = parseDraft(withDefaults(args.data ?? {}));
  const title =
    args.title ??
    data.company?.name?.trim().slice(0, 120) ??
    DEFAULT_DOCUMENT_TITLE;

  // RLS checks the role again and refuses the insert if it changed meanwhile.
  const document = await ctx.store.insertDocument({
    tenantId: membership.tenantId,
    templateId: musterprotokollMetadata.id,
    templateVersion: musterprotokollMetadata.version,
    title: title || DEFAULT_DOCUMENT_TITLE,
    data,
  });
  if (!document) throw roleError(membership, "creating documents");
  return { document: documentView(document, membership, ctx.today()) };
}

export async function updateDraft(
  ctx: ToolContext,
  args: {
    documentId: string;
    patch?: MusterprotokollDraft;
    unset?: string[];
    title?: string;
  },
): Promise<{ document: DocumentView }> {
  if (
    args.patch === undefined &&
    !args.unset?.length &&
    args.title === undefined
  ) {
    throw new ToolError("Nothing to change. Pass patch, unset, or title.");
  }
  const { document, membership } = await loadDocument(ctx, args.documentId);
  if (!membership || !canEditDocuments(membership.role)) {
    throw roleError(membership, "editing documents");
  }

  let data: MusterprotokollDraft | undefined;
  if (args.patch !== undefined || args.unset?.length) {
    assertSupportedTemplate(document);
    let merged = mergeDraft(document.data, args.patch ?? {});
    for (const path of args.unset ?? []) merged = unsetPath(merged, path);
    data = parseDraft(merged);
  }

  // The update only applies to the version that was read, so a concurrent
  // save in the web app is never overwritten silently.
  const saved = await ctx.store.updateDocument(
    args.documentId,
    {
      ...(data ? { data } : {}),
      ...(args.title !== undefined ? { title: args.title } : {}),
    },
    document.updatedAt,
  );
  if (!saved) {
    const current = await ctx.store.getDocument(args.documentId);
    if (current && current.updatedAt !== document.updatedAt) {
      throw new ToolError(
        "The document changed while it was being updated, for example in the web app. Call urkundenwerk_get_document and apply the change again.",
      );
    }
    if (!current) throw notFound(args.documentId);
    throw roleError(membership, "editing documents");
  }
  return { document: documentView(saved, membership, ctx.today()) };
}

export async function validateDocument(
  ctx: ToolContext,
  args: { documentId: string; document: ExportDocument },
): Promise<{
  documentId: string;
  referenceDate: string;
  completeness: Completeness;
  issues: ReportedIssue[];
}> {
  const { document } = await loadDocument(ctx, args.documentId);
  const referenceDate = ctx.today();
  const issues = checkDraft(
    storedDraft(document),
    referenceDate,
    args.document,
  );
  return {
    documentId: document.id,
    referenceDate,
    completeness: completenessOf(issues),
    issues: reportIssues(issues),
  };
}

export type ExportResult = {
  documentId: string;
  title: string;
  format: ExportFormat;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  resourceUri: string;
  savedTo: string | null;
  /** Warnings and notes that do not block the export. */
  issues: ReportedIssue[];
};

function assertExportReady<T>(
  validation:
    | { success: true; data: T; issues: RegisterFilingIssue[] }
    | { success: false; issues: RegisterFilingIssue[] },
) {
  if (!validation.success) {
    const errors = validation.issues.filter(
      ({ severity }) => severity === "error",
    );
    throw new ToolError(
      `The document is not ready to export: ${errors.length} rule error(s). Fix them with urkundenwerk_update_draft, then export again.`,
      { issues: reportIssues(errors) },
    );
  }
  return validation;
}

async function renderFilingXml(data: RegisterFilingData, generatedAt: string) {
  try {
    const xml = buildRegisterFilingXml(data, { generatedAt });
    if (await validateRegisterFilingXml(xml)) {
      return new TextEncoder().encode(xml);
    }
  } catch {
    // The generator or validator may include personal data in diagnostics.
  }
  throw new RegisterFilingXmlError();
}

export async function exportDocument(
  ctx: ToolContext,
  args: {
    documentId: string;
    document?: ExportDocument;
    format: ExportFormat;
    saveTo?: string;
    overwrite: boolean;
  },
): Promise<{ result: ExportResult; bytes: Uint8Array }> {
  const { document } = await loadDocument(ctx, args.documentId);
  const draft = storedDraft(document);
  const { format } = args;
  const target =
    args.document ?? (format === "xml" ? "anmeldung" : "musterprotokoll");
  // The same rules as in the web app decide; warnings do not block.
  const context = { referenceDate: ctx.today() };
  let bytes: Uint8Array;
  let issues: RegisterFilingIssue[];
  if (target === "anmeldung" || format === "xml") {
    if (target !== "anmeldung") {
      throw new ToolError(
        'XML is available for the Handelsregisteranmeldung. Omit document or pass document: "anmeldung".',
      );
    }
    const validation = assertExportReady(
      validateRegisterFiling(draft, context),
    );
    issues = validation.issues;
    bytes =
      format === "xml"
        ? await renderFilingXml(validation.data, new Date().toISOString())
        : await RENDERERS[format](buildRegisterFiling(draft, context));
  } else {
    const validation = assertExportReady(
      validateMusterprotokoll(draft, context),
    );
    issues = validation.issues;
    bytes = await RENDERERS[format](
      buildMusterprotokoll(validation.data, context),
    );
  }

  const filename = exportFilename(document.title, format, target);
  const savedTo =
    args.saveTo === undefined
      ? null
      : await writeExport(
          ctx.exportDir,
          args.saveTo,
          filename,
          bytes,
          args.overwrite,
        );

  return {
    result: {
      documentId: document.id,
      title: document.title,
      format,
      filename,
      mimeType: CONTENT_TYPES[format],
      sizeBytes: bytes.byteLength,
      resourceUri: `urkundenwerk://documents/${document.id}/export/${filename}`,
      savedTo,
      issues: reportIssues(issues),
    },
    bytes,
  };
}

export async function deleteDraft(
  ctx: ToolContext,
  args: { documentId: string },
): Promise<{ deleted: true; documentId: string; title: string }> {
  const { document, membership } = await loadDocument(ctx, args.documentId);
  if (!membership || !canEditDocuments(membership.role)) {
    throw roleError(membership, "deleting documents");
  }
  if (!(await ctx.store.deleteDocument(args.documentId))) {
    throw roleError(membership, "deleting documents");
  }
  return { deleted: true, documentId: document.id, title: document.title };
}
