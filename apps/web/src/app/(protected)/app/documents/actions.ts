"use server";

import { musterprotokollMetadata } from "@urkundenwerk/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { withDefaults } from "../../../../lib/builder/form-model";
import {
  deleteDocument as deleteDocumentRow,
  insertDocument,
  updateDocument,
} from "../../../../lib/documents/repository";
import {
  DEFAULT_DOCUMENT_TITLE,
  documentIdSchema,
  documentTitleSchema,
  draftDataSchema,
} from "../../../../lib/documents/schemas";
import { createClient, getVerifiedUser } from "../../../../lib/supabase/server";

// Every action verifies the user with the Auth server and then writes through
// the per-request client, so row-level security authorizes each change.

export type ActionResult<T = object> =
  ({ ok: true } & T) | { ok: false; error: string };

const NOT_ALLOWED =
  "This document was not found, or you do not have permission to change it.";

async function signedInClient() {
  const user = await getVerifiedUser();
  if (!user) redirect("/login");
  return { user, supabase: await createClient() };
}

function firstMessage(error: z.ZodError): string {
  return error.issues[0]?.message ?? "The request is invalid.";
}

/** Creates a Musterprotokoll draft with the default choices in the given firm and opens it. */
export async function createDocument(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const tenantId = documentIdSchema.safeParse(formData.get("tenantId"));
  if (!tenantId.success) return { ok: false, error: "Choose a firm first." };

  const { user, supabase } = await signedInClient();
  const document = await insertDocument(supabase, {
    tenantId: tenantId.data,
    templateId: musterprotokollMetadata.id,
    templateVersion: musterprotokollMetadata.version,
    title: DEFAULT_DOCUMENT_TITLE,
    createdBy: user.id,
    data: withDefaults({}),
  });
  if (!document) {
    return {
      ok: false,
      error: "Your role in this firm does not allow creating documents.",
    };
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
  if (!documentId.success) return { ok: false, error: NOT_ALLOWED };
  const draft = draftDataSchema.safeParse(data);
  if (!draft.success) return { ok: false, error: firstMessage(draft.error) };

  const { supabase } = await signedInClient();
  const saved = await updateDocument(supabase, documentId.data, {
    data: draft.data,
  });
  if (!saved) return { ok: false, error: NOT_ALLOWED };
  return { ok: true, updatedAt: saved.updated_at };
}

export async function renameDocument(
  id: unknown,
  title: unknown,
): Promise<ActionResult<{ title: string; updatedAt: string }>> {
  const documentId = documentIdSchema.safeParse(id);
  if (!documentId.success) return { ok: false, error: NOT_ALLOWED };
  const parsedTitle = documentTitleSchema.safeParse(title);
  if (!parsedTitle.success) {
    return { ok: false, error: firstMessage(parsedTitle.error) };
  }

  const { supabase } = await signedInClient();
  const saved = await updateDocument(supabase, documentId.data, {
    title: parsedTitle.data,
  });
  if (!saved) return { ok: false, error: NOT_ALLOWED };

  revalidatePath("/app");
  return { ok: true, title: parsedTitle.data, updatedAt: saved.updated_at };
}

/** Deletes a document and returns to the dashboard. */
export async function deleteDocument(
  _previous: ActionResult,
  formData: FormData,
): Promise<ActionResult> {
  const documentId = documentIdSchema.safeParse(formData.get("documentId"));
  if (!documentId.success) return { ok: false, error: NOT_ALLOWED };

  const { supabase } = await signedInClient();
  if (!(await deleteDocumentRow(supabase, documentId.data))) {
    return { ok: false, error: NOT_ALLOWED };
  }

  revalidatePath("/app");
  redirect("/app");
}
