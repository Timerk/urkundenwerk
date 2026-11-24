"use server";

import { musterprotokollMetadata } from "@urkundenwerk/core";
import {
  ExtractionError,
  type FieldReview,
  ingestDocument,
  IngestionError,
  type SourceDocument,
} from "@urkundenwerk/extraction";
import { getLocale, getTranslations } from "next-intl/server";
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
  MAX_UPLOAD_MEGABYTES,
} from "../../../../lib/import/limits";
import { insertDocument } from "../../../../lib/documents/repository";
import {
  defaultDocumentTitle,
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

// Errors are translated here, in the language of the request, from the
// stable codes of the upload check, ingestion, and extraction.

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
  const t = await getTranslations("import");
  const access = await editorOf(formData.get("tenantId"));
  if (!access) return { ok: false, error: t("errors.notAllowed") };
  if (!isExtractionEnabled()) {
    return { ok: false, error: t("errors.disabled") };
  }

  const file = formData.get("file");
  const size = MAX_UPLOAD_MEGABYTES;
  if (!(file instanceof File)) {
    return { ok: false, error: t("upload.missing") };
  }
  const problem = checkUpload(file);
  if (problem) return { ok: false, error: t(`upload.${problem}`, { size }) };

  if (!takeExtractionQuota(access.user.id)) {
    return {
      ok: false,
      error: t("errors.rateLimited", {
        count: EXTRACTIONS_PER_WINDOW,
        minutes: EXTRACTION_WINDOW_MS / 60_000,
      }),
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
      return { ok: false, error: t(`ingestion.${error.code}`, { size }) };
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
      return { ok: false, error: t(`extraction.${error.code}`) };
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
  const t = await getTranslations("import.errors");
  const access = await editorOf(tenantId);
  if (!access) return { ok: false, error: t("notAllowed") };
  const draft = draftDataSchema.safeParse(data);
  if (!draft.success) return { ok: false, error: t("invalidDraft") };

  const firma = draft.data.company?.name?.trim();
  const supabase = await createClient();
  const document = await insertDocument(supabase, {
    tenantId: access.membership.tenantId,
    templateId: musterprotokollMetadata.id,
    templateVersion: musterprotokollMetadata.version,
    title: firma
      ? firma.slice(0, 120)
      : defaultDocumentTitle(await getLocale()),
    createdBy: access.user.id,
    data: draft.data,
  });
  if (!document) return { ok: false, error: t("notAllowed") };

  revalidatePath("/app");
  redirect(`/app/documents/${document.id}?imported=1`);
}
