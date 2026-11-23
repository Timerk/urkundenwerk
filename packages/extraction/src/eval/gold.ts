import { musterprotokollDraftSchema } from "@urkundenwerk/core";
import { z } from "zod";
import { locateQuote } from "../citations";
import {
  extractionFieldPathSchema,
  isFieldValue,
  type ExtractionFieldPath,
} from "../result";
import type { SourceDocument } from "../source";

const freeTextPaths = new Set<ExtractionFieldPath>([
  "company.purpose",
  "founder.identificationDetails",
  "notaryNotes",
]);

export function isFreeTextField(path: ExtractionFieldPath): boolean {
  return freeTextPaths.has(path);
}

export const goldValueSchema = z.strictObject({
  value: z.union([z.string().trim().min(1), z.int(), z.null()]),
  quote: z.string().trim().min(1),
});

export const goldDocumentSchema = z
  .strictObject({
    fields: z.record(extractionFieldPathSchema, goldValueSchema.nullable()),
  })
  .superRefine(({ fields }, context) => {
    const draft: Record<string, unknown> = {};
    for (const [path, label] of Object.entries(fields)) {
      if (!label) continue;
      const typedPath = extractionFieldPathSchema.parse(path);
      if (!isFieldValue(typedPath, label.value)) {
        context.addIssue({
          code: "custom",
          path: ["fields", path, "value"],
          message: "Invalid draft value",
        });
        continue;
      }
      const keys = path.split(".");
      const leaf = keys.pop()!;
      let parent = draft;
      for (const key of keys) {
        parent = (parent[key] ??= {}) as Record<string, unknown>;
      }
      parent[leaf] = label.value;
    }
    const result = musterprotokollDraftSchema.safeParse(draft);
    if (!result.success) {
      context.addIssue({
        code: "custom",
        path: ["fields"],
        message: "Labels do not assemble into a valid draft",
      });
    }
  });

export type GoldValue = z.infer<typeof goldValueSchema>;
export type GoldDocument = z.infer<typeof goldDocumentSchema>;

export function anchorGoldEvidence(
  source: SourceDocument,
  path: ExtractionFieldPath,
  label: GoldValue,
) {
  const citation = locateQuote(source, label.quote);
  if (!citation)
    throw new Error(`Unlocatable gold evidence for ${path}: ${label.quote}`);
  if (isFreeTextField(path)) {
    const evidence = citation.quote.replace(/\s+/gu, " ");
    const value =
      typeof label.value === "string"
        ? label.value.replace(/\s+/gu, " ")
        : undefined;
    if (!value || !evidence.includes(value)) {
      throw new Error(
        `Gold value for ${path} must be verbatim within its evidence: ${label.value}`,
      );
    }
  }
  return citation;
}
