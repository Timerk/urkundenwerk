"use server";

import { musterprotokollMetadata } from "@urkundenwerk/core";
import {
  ExtractionError,
  type FieldReview,
  ingestDocument,
  IngestionError,
  type SourceDocument,
} from "@urkundenwerk/extraction";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  EXTRACTION_WINDOW_MS,
  EXTRACTIONS_PER_WINDOW,
  extract,
  isExtractionEnabled,
  takeExtractionQuota,
} from "../../../../lib/import/extraction";
import {
  checkUpload,
  MAX_UPLOAD_BYTES,
  UPLOAD_MESSAGES,
} from "../../../../lib/import/limits";
import { insertDocument } from "../../../../lib/documents/repository";
import {
  DEFAULT_DOCUMENT_TITLE,
  documentIdSchema,
  draftDataSchema,
} from "../../../../lib/documents/schemas";
import { createClient, getVerifiedUser } from "../../../../lib/supabase/server";
import { getMemberships } from "../../../../lib/tenants/memberships";
import { canEditDocuments } from "../../../../lib/tenants/selection";

export type ImportActionResult<T = object> =
  ({ ok: true } & T) | { ok: false; error: string };

/** What the review screen needs. Nothing of it is stored on the server. */
export type ExtractedContract = {
  fileName: string;
  source: SourceDocument;
  fields: FieldReview[];
  suspiciousSegments: string[];
  model: string;
  promptVersion: string;
};

const NOT_ALLOWED =
  "Importing contracts needs the editor or admin role in this firm.";

async function editorOf(tenantId: unknown) {
  const user = await getVerifiedUser();
  if (!user) redirect("/login");
  const id = documentIdSchema.safeParse(tenantId);
  const membership = id.success
    ? (await getMemberships()).find(({ tenantId }) => tenantId === id.data)
    : undefined;
  return membership && canEditDocuments(membership.role)
    ? { user, membership }
    : null;
}

// Ingestion errors already have messages fit to show; a few get advice.
const INGESTION_ADVICE: Partial<Record<IngestionError["code"], string>> = {
  FILE_TOO_LARGE: UPLOAD_MESSAGES.size,
  UNSUPPORTED_FORMAT: UPLOAD_MESSAGES.type,
  PDF_NO_TEXT:
    "This PDF has no text layer, which usually means it is a scan. Scanned documents cannot be imported yet; use a PDF exported from a word processor or a DOCX.",
};

/**
 * Reads an uploaded contract and asks the configured model for draft
 * values. Only editors and admins of the firm may call it, a few times per
 * user and ten minutes. The upload and the result are not stored: they go
 * back to the browser for review, and only values the user confirms are
 * saved, with `createDraftFromImport`.
 */
export async function extractContract(
  formData: FormData,
): Promise<ImportActionResult<{ contract: ExtractedContract }>> {
  const access = await editorOf(formData.get("tenantId"));
  if (!access) return { ok: false, error: NOT_ALLOWED };
  if (!isExtractionEnabled()) {
    return {
      ok: false,
      error: "AI extraction is not configured on this server.",
    };
  }

  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { ok: false, error: UPLOAD_MESSAGES.missing };
  }
  const problem = checkUpload(file);
  if (problem) return { ok: false, error: problem };

  if (!takeExtractionQuota(access.user.id)) {
    return {
      ok: false,
      error: `You can import ${EXTRACTIONS_PER_WINDOW} contracts every ${EXTRACTION_WINDOW_MS / 60_000} minutes. Try again shortly.`,
    };
  }

  let source: SourceDocument;
  try {
    source = await ingestDocument(new Uint8Array(await file.arrayBuffer()), {
      filename: file.name,
      maxBytes: MAX_UPLOAD_BYTES,
    });
  } catch (error) {
    if (error instanceof IngestionError) {
      return {
        ok: false,
        error: INGESTION_ADVICE[error.code] ?? error.message,
      };
    }
    throw error;
  }

  try {
    const review = await extract(source);
    return {
      ok: true,
      contract: {
        fileName: file.name.slice(0, 200),
        source,
        fields: review.fields,
        suspiciousSegments: review.suspiciousSegments,
        model: review.model,
        promptVersion: review.promptVersion,
      },
    };
  } catch (error) {
    if (error instanceof ExtractionError) {
      return { ok: false, error: error.message };
    }
    throw error;
  }
}

/**
 * Creates a draft from the values the user accepted on the review screen and
 * opens it in the builder. The draft is validated like any other, and row-
 * level security decides whether the user may create it. No quotes, document
 * text, or extraction metadata are stored.
 */
export async function createDraftFromImport(
  tenantId: unknown,
  data: unknown,
): Promise<ImportActionResult> {
  const access = await editorOf(tenantId);
  if (!access) return { ok: false, error: NOT_ALLOWED };
  const draft = draftDataSchema.safeParse(data);
  if (!draft.success) {
    return {
      ok: false,
      error: "Some accepted values are not valid for the Musterprotokoll.",
    };
  }

  const firma = draft.data.company?.name?.trim();
  const supabase = await createClient();
  const document = await insertDocument(supabase, {
    tenantId: access.membership.tenantId,
    templateId: musterprotokollMetadata.id,
    templateVersion: musterprotokollMetadata.version,
    title: firma ? firma.slice(0, 120) : DEFAULT_DOCUMENT_TITLE,
    createdBy: access.user.id,
    data: draft.data,
  });
  if (!document) return { ok: false, error: NOT_ALLOWED };

  revalidatePath("/app");
  redirect(`/app/documents/${document.id}?imported=1`);
}
