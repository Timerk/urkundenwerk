import "server-only";
import { z } from "zod";
import type { AppSupabaseClient } from "../documents/repository";
import type { ExportDocument, ExportFormat } from "../documents/schemas";

/*
 * Exports and imports are the two events the database cannot see for itself.
 * They are reported with the signed-in user's client through
 * `record_document_event`, which takes the actor from the session and checks
 * the metadata again. Changes to rows are recorded by triggers.
 */

const decisionCountsSchema = z.strictObject({
  accepted: z.int().min(0).max(999),
  edited: z.int().min(0).max(999),
  cleared: z.int().min(0).max(999),
});

/**
 * What the review screen decided, per extraction status. Model and prompt
 * version are reported by the browser, so they are checked for shape here
 * and in the database; they are provenance, not proof.
 */
export const importProvenanceSchema = z.strictObject({
  model: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,79}$/),
  promptVersion: z.string().regex(/^[A-Za-z0-9][A-Za-z0-9._-]{0,63}$/),
  counts: z.strictObject({
    verified: decisionCountsSchema,
    unverified: decisionCountsSchema,
    absent: decisionCountsSchema,
  }),
});

export type ImportProvenance = z.infer<typeof importProvenanceSchema>;

/** Records a download. Returns `false` if the event could not be stored. */
export async function recordExport(
  supabase: AppSupabaseClient,
  documentId: string,
  format: ExportFormat,
  document: ExportDocument,
): Promise<boolean> {
  const { error } = await supabase.rpc("record_document_event", {
    document_id: documentId,
    action: "document.exported",
    metadata: { format, document },
  });
  if (error) console.error(`[audit] export event failed (${error.code})`);
  return !error;
}

/** Records where a draft created from a contract import came from. */
export async function recordImport(
  supabase: AppSupabaseClient,
  documentId: string,
  provenance: ImportProvenance,
): Promise<boolean> {
  const { error } = await supabase.rpc("record_document_event", {
    document_id: documentId,
    action: "document.imported",
    metadata: provenance,
  });
  if (error) console.error(`[audit] import event failed (${error.code})`);
  return !error;
}
