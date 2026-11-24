import { musterprotokollDraftSchema } from "@urkundenwerk/core";
import { z } from "zod";
import { en } from "../../i18n/messages/en";
import { de } from "../../i18n/messages/de";
import type { Locale } from "../../i18n/locale";

/** Drafts are a few KiB; the limit leaves room while bounding every write. */
export const MAX_DRAFT_BYTES = 32 * 1024;

export const documentIdSchema = z.uuid();

/**
 * The title a new document gets, in the creator's UI language. It is data:
 * it stays as created when the language changes.
 */
export function defaultDocumentTitle(locale: Locale): string {
  return locale === "de"
    ? de.documents.defaultTitle
    : en.documents.defaultTitle;
}

/** New documents take the Firma as their title while they keep a default one. */
export function isDefaultDocumentTitle(title: string): boolean {
  return (
    title === en.documents.defaultTitle || title === de.documents.defaultTitle
  );
}

export const MAX_TITLE_LENGTH = 120;

// Error messages are keys of `documents.errors`; actions translate them.

/** Matches the length check on `public.documents.title`. */
export const documentTitleSchema = z
  .string({ error: "titleRequired" })
  .trim()
  .min(1, { error: "titleRequired" })
  .max(MAX_TITLE_LENGTH, { error: "titleLong" });

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
    error: "draftTooLarge",
    abort: true,
  })
  .pipe(musterprotokollDraftSchema);

export const exportFormatSchema = z.enum(["pdf", "docx", "xml"]);

export type ExportFormat = z.infer<typeof exportFormatSchema>;
export const exportDocumentSchema = z.enum(["musterprotokoll", "anmeldung"]);
export type ExportDocument = z.infer<typeof exportDocumentSchema>;
