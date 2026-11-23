import { evaluateRules, passes } from "../../rules/engine";
import type { Issue, RuleContext } from "../../rules/types";
import { type MusterprotokollDraft, normaliseDraft } from "./draft";
import { musterprotokollRules, type MusterprotokollRuleCode } from "./rules";
import { musterprotokollSchema, type MusterprotokollData } from "./schema";

export type MusterprotokollIssue = Issue<MusterprotokollRuleCode>;

/** Runs every Musterprotokoll rule on a possibly incomplete draft. */
export function checkMusterprotokoll(
  draft: MusterprotokollDraft,
  context: RuleContext,
): MusterprotokollIssue[] {
  return evaluateRules(musterprotokollRules, normaliseDraft(draft), context);
}

export type MusterprotokollValidation =
  | {
      success: true;
      data: MusterprotokollData;
      /** Warnings and notes that do not block the deed. */
      issues: MusterprotokollIssue[];
    }
  | { success: false; issues: MusterprotokollIssue[] };

/**
 * Validates a draft or complete input for an export: the rules must report
 * no error. The schema then parses the input into the data the template uses.
 */
export function validateMusterprotokoll(
  draft: MusterprotokollDraft,
  context: RuleContext,
): MusterprotokollValidation {
  const issues = checkMusterprotokoll(draft, context);
  if (!passes(issues)) return { success: false, issues };
  // The schema rules already reported any structural problem.
  const data = musterprotokollSchema.parse(normaliseDraft(draft));
  return { success: true, data, issues };
}

/** Thrown when a deed is built from input that does not pass the rules. */
export class MusterprotokollValidationError extends Error {
  readonly issues: readonly MusterprotokollIssue[];

  constructor(issues: readonly MusterprotokollIssue[]) {
    const codes = [...new Set(issues.map((issue) => issue.code))].join(", ");
    super(`The Musterprotokoll input is not valid: ${codes}`);
    this.name = "MusterprotokollValidationError";
    this.issues = issues;
  }
}
