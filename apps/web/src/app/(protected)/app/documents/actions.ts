"use server";

import {
  type ExplanationResult,
  explainableIssueSchema,
} from "@urkundenwerk/ai";
import {
  musterprotokollMetadata,
  registerFilingMetadata,
} from "@urkundenwerk/core";
import { getLocale, getTranslations } from "next-intl/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { explain, isExplanationEnabled } from "../../../../lib/ai/explanations";
import { EXPLANATIONS_PER_MINUTE } from "../../../../lib/ai/quota";
import { withDefaults } from "../../../../lib/builder/form-model";
import {
  deleteDocument as deleteDocumentRow,
  getDocument,
  insertDocument,
  updateDocument,
} from "../../../../lib/documents/repository";
import {
  defaultDocumentTitle,
  documentIdSchema,
  documentTitleSchema,
  draftDataSchema,
  exportDocumentSchema,
  MAX_DRAFT_BYTES,
  MAX_TITLE_LENGTH,
} from "../../../../lib/documents/schemas";
import { createClient, getVerifiedUser } from "../../../../lib/supabase/server";

// Every action verifies the user with the Auth server and then writes through
// the per-request client, so row-level security authorizes each change.
// Errors are translated here, in the language of the request.

export type ActionResult<T = object> =
  ({ ok: true } & T) | { ok: false; error: string };

async function signedInClient() {
  const user = await getVerifiedUser();
  if (!user) redirect("/login");
  return { user, supabase: await createClient() };
}

async function errors() {
  return getTranslations("documents.errors");
}

/** The first schema error in words. Unknown messages come from the draft schema. */
async function firstMessage(error: z.ZodError): Promise<string> {
  const t = await errors();
  switch (error.issues[0]?.message) {
    case "titleRequired":
      return t("titleRequired");
    case "titleLong":
      return t("titleLong", { max: MAX_TITLE_LENGTH });
    case "draftTooLarge":
      return t("draftTooLarge", { size: MAX_DRAFT_BYTES / 1024 });
    case undefined:
      return t("invalid");
    default:
      return t("draftInvalid");
  }
}

async function notAllowed() {
  return { ok: false as const, error: (await errors())("notAllowed") };
}

/** Creates a Musterprotokoll draft with the default choices in the given firm and opens it. */
export async function createDocument(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const tenantId = documentIdSchema.safeParse(formData.get("tenantId"));
  if (!tenantId.success) {
    return { ok: false, error: (await errors())("chooseFirm") };
  }

  const { user, supabase } = await signedInClient();
  const document = await insertDocument(supabase, {
    tenantId: tenantId.data,
    templateId: musterprotokollMetadata.id,
    templateVersion: musterprotokollMetadata.version,
    title: defaultDocumentTitle(await getLocale()),
    createdBy: user.id,
    data: withDefaults({}),
  });
  if (!document) {
    return { ok: false, error: (await errors())("cannotCreate") };
  }

  revalidatePath("/app");
  redirect(`/app/documents/${document.id}`);
}

/** Saves the builder's form input. Incomplete drafts are expected. */
export async function saveDraft(
  id: unknown,
  data: unknown,
): Promise<ActionResult<{ updatedAt: string }>> {
  const documentId = documentIdSchema.safeParse(id);
  if (!documentId.success) return notAllowed();
  const draft = draftDataSchema.safeParse(data);
  if (!draft.success) {
    return { ok: false, error: await firstMessage(draft.error) };
  }

  const { supabase } = await signedInClient();
  const saved = await updateDocument(supabase, documentId.data, {
    data: draft.data,
  });
  if (!saved) return notAllowed();
  revalidatePath(`/app/documents/${documentId.data}`);
  return { ok: true, updatedAt: saved.updated_at };
}

export async function renameDocument(
  id: unknown,
  title: unknown,
): Promise<ActionResult<{ title: string; updatedAt: string }>> {
  const documentId = documentIdSchema.safeParse(id);
  if (!documentId.success) return notAllowed();
  const parsedTitle = documentTitleSchema.safeParse(title);
  if (!parsedTitle.success) {
    return { ok: false, error: await firstMessage(parsedTitle.error) };
  }

  const { supabase } = await signedInClient();
  const saved = await updateDocument(supabase, documentId.data, {
    title: parsedTitle.data,
  });
  if (!saved) return notAllowed();

  revalidatePath("/app");
  return { ok: true, title: parsedTitle.data, updatedAt: saved.updated_at };
}

/** Deletes a document; the dashboard announces the result in place. */
export async function deleteDocument(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const documentId = documentIdSchema.safeParse(formData.get("documentId"));
  if (!documentId.success) return notAllowed();

  const { supabase } = await signedInClient();
  if (!(await deleteDocumentRow(supabase, documentId.data))) {
    return notAllowed();
  }

  revalidatePath("/app");
  return { ok: true };
}

const explainRequestSchema = z.array(explainableIssueSchema).min(1).max(20);

/**
 * Explains rule issues of a document with an LLM, in the request's UI
 * language. Members
 * of the document's firm may call it, viewers included; row-level security
 * decides whether the document exists for the caller. Only rule codes and
 * numeric params are accepted, so no draft text can reach the model.
 */
export async function explainDocumentIssues(
  id: unknown,
  issues: unknown,
  target?: unknown,
): Promise<ActionResult<{ result: ExplanationResult }>> {
  const t = await errors();
  const documentId = documentIdSchema.safeParse(id);
  if (!documentId.success) return { ok: false, error: t("notFound") };
  const request = explainRequestSchema.safeParse(issues);
  const requestedDocument = exportDocumentSchema.safeParse(
    target ?? "musterprotokoll",
  );
  if (!request.success || !requestedDocument.success) {
    return { ok: false, error: t("notExplainable") };
  }

  const { supabase } = await signedInClient();
  const document = await getDocument(supabase, documentId.data);
  if (!document) return { ok: false, error: t("notFound") };
  if (!isExplanationEnabled()) return { ok: false, error: t("aiOff") };

  const templateId =
    requestedDocument.data === "anmeldung" &&
    document.template_id === musterprotokollMetadata.id
      ? registerFilingMetadata.id
      : document.template_id;
  const result = await explain(
    supabase,
    templateId,
    request.data,
    await getLocale(),
  );
  if (result.failure === "user_quota") {
    return {
      ok: false,
      error: t("rateLimited", { count: EXPLANATIONS_PER_MINUTE }),
    };
  }
  return { ok: true, result };
}
