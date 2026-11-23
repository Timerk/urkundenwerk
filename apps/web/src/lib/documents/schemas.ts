import { musterprotokollDraftSchema } from "@urkundenwerk/core";
import { z } from "zod";

/** Drafts are a few KiB; the limit leaves room while bounding every write. */
export const MAX_DRAFT_BYTES = 32 * 1024;

export const documentIdSchema = z.uuid();

/** New documents take the Firma as their title once it is entered. */
export const DEFAULT_DOCUMENT_TITLE = "Untitled Musterprotokoll";

/** Matches the length check on `public.documents.title`. */
export const documentTitleSchema = z
  .string({ error: "Enter a title." })
  .trim()
  .min(1, { error: "Enter a title." })
  .max(120, { error: "The title can have at most 120 characters." });

function jsonByteLength(value: unknown): number {
  try {
    return new TextEncoder().encode(JSON.stringify(value) ?? "").length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

/**
 * Draft data as sent by the builder. The size check runs before the shape
 * check, so oversized payloads are rejected without walking them.
 */
export const draftDataSchema = z
  .unknown()
  .refine((value) => jsonByteLength(value) <= MAX_DRAFT_BYTES, {
    error: `The draft exceeds ${MAX_DRAFT_BYTES / 1024} KiB.`,
    abort: true,
  })
  .pipe(musterprotokollDraftSchema);

export const exportFormatSchema = z.enum(["pdf", "docx", "xml"]);

export type ExportFormat = z.infer<typeof exportFormatSchema>;
export const exportDocumentSchema = z.enum(["musterprotokoll", "anmeldung"]);
export type ExportDocument = z.infer<typeof exportDocumentSchema>;
