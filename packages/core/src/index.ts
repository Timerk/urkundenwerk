import { z } from "zod";

/** A signed EUR amount represented in whole cents. */
export const eurAmountSchema = z.object({
  currency: z.literal("EUR"),
  cents: z.int(),
});

export type EurAmount = z.infer<typeof eurAmountSchema>;

export type {
  DocumentBlock,
  DocumentModel,
  InlineRun,
  SignaturesBlock,
  TemplateMetadata,
} from "./documents/model";
export { inlineRunText, toPlainText } from "./documents/plain-text";
export {
  formatEuroAmount,
  formatEuroInWords,
  formatGermanDate,
} from "./formatting";
export {
  draftToInput,
  musterprotokollDraftSchema,
  parseDraftAsInput,
  type MusterprotokollDraft,
} from "./templates/musterprotokoll-einpersonen/draft";
export {
  musterprotokollSchema,
  type MusterprotokollData,
  type MusterprotokollInput,
  type MusterprotokollRuleCode,
} from "./templates/musterprotokoll-einpersonen/schema";
export {
  buildMusterprotokoll,
  buildMusterprotokollPreview,
  musterprotokollMetadata,
  musterprotokollTemplate,
} from "./templates/musterprotokoll-einpersonen/template";
export { getTemplate, type TemplateId } from "./templates/registry";
