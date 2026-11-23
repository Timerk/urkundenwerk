import { evaluateRules, passes } from "../../rules/engine";
import type { Issue, RuleContext } from "../../rules/types";
import {
  normaliseDraft,
  type MusterprotokollDraft,
} from "../musterprotokoll-einpersonen/draft";
import { checkMusterprotokoll } from "../musterprotokoll-einpersonen/validate";
import type { MusterprotokollRuleCode } from "../musterprotokoll-einpersonen/rules";
import { registerFilingRules, type RegisterFilingRuleCode } from "./rules";
import {
  normaliseFiling,
  registerFilingSchema,
  type RegisterFilingData,
} from "./schema";

export type RegisterFilingIssue = Issue<
  RegisterFilingRuleCode | MusterprotokollRuleCode
>;

export function normaliseRegisterFiling(draft: MusterprotokollDraft) {
  return { ...normaliseDraft(draft), filing: normaliseFiling(draft.filing) };
}

/** The filing depends on a valid deed, so both sets of checks apply. */
export function checkRegisterFiling(
  draft: MusterprotokollDraft,
  context: RuleContext,
): RegisterFilingIssue[] {
  const deedIssues = checkMusterprotokoll(draft, context);
  return [
    ...deedIssues.filter(({ severity }) => severity === "error"),
    ...evaluateRules(
      registerFilingRules,
      normaliseRegisterFiling(draft),
      context,
    ),
    ...deedIssues.filter(({ severity }) => severity !== "error"),
  ];
}

export type RegisterFilingValidation =
  | { success: true; data: RegisterFilingData; issues: RegisterFilingIssue[] }
  | { success: false; issues: RegisterFilingIssue[] };

/** Accepts drafts parsed with musterprotokollDraftSchema at the boundary. */
export function validateRegisterFiling(
  draft: MusterprotokollDraft,
  context: RuleContext,
): RegisterFilingValidation {
  const issues = checkRegisterFiling(draft, context);
  if (!passes(issues)) return { success: false, issues };
  return {
    success: true,
    data: registerFilingSchema.parse(normaliseRegisterFiling(draft)),
    issues,
  };
}

export class RegisterFilingValidationError extends Error {
  constructor(readonly issues: readonly RegisterFilingIssue[]) {
    const codes = [...new Set(issues.map(({ code }) => code))].join(", ");
    super(`The register filing input is not valid: ${codes}`);
    this.name = "RegisterFilingValidationError";
  }
}
