import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { MusterprotokollDraft } from "@urkundenwerk/core";
import type { Database } from "@urkundenwerk/core/db";

/**
 * Data access for `public.documents`. Every function takes the per-request
 * client that runs as the signed-in user, so row-level security decides which
 * rows exist and which writes succeed. Never pass a client created with the
 * secret key.
 */
export type AppSupabaseClient = SupabaseClient<Database>;

export type DocumentRow = Database["public"]["Tables"]["documents"]["Row"];

export type DocumentSummary = Pick<
  DocumentRow,
  | "id"
  | "title"
  | "template_id"
  | "template_version"
  | "status"
  | "updated_at"
  | "data"
>;

const INSUFFICIENT_PRIVILEGE = "42501";

export class DocumentStoreError extends Error {
  constructor(operation: string, options?: ErrorOptions) {
    super(`Could not ${operation} the document.`, options);
    this.name = "DocumentStoreError";
  }
}

/** Lists the documents of one tenant, most recently changed first. */
export async function listDocuments(
  supabase: AppSupabaseClient,
  tenantId: string,
): Promise<DocumentSummary[]> {
  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, title, template_id, template_version, status, updated_at, data",
    )
    .eq("tenant_id", tenantId)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) throw new DocumentStoreError("list", { cause: error });
  return data;
}

/** Returns the document, or `null` if it does not exist or is not visible. */
export async function getDocument(
  supabase: AppSupabaseClient,
  id: string,
): Promise<DocumentRow | null> {
  const { data, error } = await supabase
    .from("documents")
    .select(
      "id, tenant_id, template_id, template_version, title, data, status, created_by, created_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();
  if (error) throw new DocumentStoreError("load", { cause: error });
  return data;
}

/** Creates a draft. Returns `null` if the caller may not write to the tenant. */
export async function insertDocument(
  supabase: AppSupabaseClient,
  values: {
    tenantId: string;
    templateId: string;
    templateVersion: string;
    title: string;
    createdBy: string;
    data?: MusterprotokollDraft;
  },
): Promise<Pick<DocumentRow, "id"> | null> {
  const { data, error } = await supabase
    .from("documents")
    .insert({
      tenant_id: values.tenantId,
      template_id: values.templateId,
      template_version: values.templateVersion,
      title: values.title,
      created_by: values.createdBy,
      data: values.data,
    })
    .select("id")
    .single();
  if (error?.code === INSUFFICIENT_PRIVILEGE) return null;
  if (error) throw new DocumentStoreError("create", { cause: error });
  return data;
}

/**
 * Updates the title or the draft data. Returns `null` if the document does not
 * exist or the caller may not change it; RLS hides both cases alike.
 */
export async function updateDocument(
  supabase: AppSupabaseClient,
  id: string,
  changes: { title?: string; data?: MusterprotokollDraft },
): Promise<Pick<DocumentRow, "id" | "updated_at"> | null> {
  const { data, error } = await supabase
    .from("documents")
    .update(changes)
    .eq("id", id)
    .select("id, updated_at")
    .maybeSingle();
  if (error) throw new DocumentStoreError("save", { cause: error });
  return data;
}

/** Deletes the document. Returns `false` if nothing was deleted. */
export async function deleteDocument(
  supabase: AppSupabaseClient,
  id: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from("documents")
    .delete()
    .eq("id", id)
    .select("id");
  if (error) throw new DocumentStoreError("delete", { cause: error });
  return data.length > 0;
}
