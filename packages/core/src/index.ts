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
  normaliseDraft,
  type MusterprotokollCandidate,
  type MusterprotokollDraft,
} from "./templates/musterprotokoll-einpersonen/draft";
export {
  musterprotokollSchema,
  type MusterprotokollData,
  type MusterprotokollInput,
} from "./templates/musterprotokoll-einpersonen/schema";
export {
  FORMATION_COST_CAP_CENTS,
  FULL_AGE_YEARS,
  GENERIC_PURPOSES,
  legalFormOf,
  MINIMUM_GMBH_CAPITAL_CENTS,
  musterprotokollRules,
  type LegalForm,
  type MusterprotokollRuleCode,
} from "./templates/musterprotokoll-einpersonen/rules";
export {
  checkMusterprotokoll,
  MusterprotokollValidationError,
  validateMusterprotokoll,
  type MusterprotokollIssue,
  type MusterprotokollValidation,
} from "./templates/musterprotokoll-einpersonen/validate";
export { passes } from "./rules/engine";
export {
  getRule,
  rulesFor,
  runRules,
  type RuleCode,
  type RuleTemplateId,
} from "./rules";
export {
  SEVERITIES,
  type Issue,
  type IssueParams,
  type Rule,
  type RuleContext,
  type Severity,
} from "./rules/types";
export {
  buildMusterprotokoll,
  buildMusterprotokollPreview,
  musterprotokollMetadata,
  musterprotokollTemplate,
} from "./templates/musterprotokoll-einpersonen/template";
export { getTemplate, type TemplateId } from "./templates/registry";
