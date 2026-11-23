import type { MusterprotokollDraft } from "../templates/musterprotokoll-einpersonen/draft";
import { musterprotokollMetadata } from "../templates/musterprotokoll-einpersonen/metadata";
import {
  type MusterprotokollRuleCode,
  musterprotokollRules,
} from "../templates/musterprotokoll-einpersonen/rules";
import { checkMusterprotokoll } from "../templates/musterprotokoll-einpersonen/validate";
import type { Issue, Rule, RuleContext } from "./types";

/** Rule sets by template id. Each template's rules read its own draft shape. */
const ruleSets = {
  [musterprotokollMetadata.id]: {
    rules: musterprotokollRules,
    check: checkMusterprotokoll,
  },
  [registerFilingMetadata.id]: {
    rules: [...musterprotokollRules, ...registerFilingRules],
    check: checkRegisterFiling,
  },
} as const;

export type RuleTemplateId = keyof typeof ruleSets;
export type RuleCode = MusterprotokollRuleCode | RegisterFilingRuleCode;

/**
 * Runs the rules of a template on a draft or complete input and returns the
 * issues sorted by severity: errors, then warnings, then notes.
 */
export function runRules(
  templateId: RuleTemplateId,
  draft: MusterprotokollDraft,
  context: RuleContext,
): Issue<RuleCode>[] {
  return ruleSets[templateId].check(draft, context);
}

/** The rules registered for a template, or an empty list. */
export function rulesFor(
  templateId: string,
): readonly Rule<unknown, RuleCode>[] {
  return Object.hasOwn(ruleSets, templateId)
    ? (ruleSets[templateId as RuleTemplateId].rules as readonly Rule<
        unknown,
        RuleCode
      >[])
    : [];
}

/** Looks up a rule by template and code. */
export function getRule(
  templateId: string,
  code: string,
): Rule<unknown, RuleCode> | undefined {
  return rulesFor(templateId).find((rule) => rule.id === code);
}
import { registerFilingMetadata } from "../templates/handelsregisteranmeldung-gmbh/metadata";
import {
  registerFilingRules,
  type RegisterFilingRuleCode,
} from "../templates/handelsregisteranmeldung-gmbh/rules";
import { checkRegisterFiling } from "../templates/handelsregisteranmeldung-gmbh/validate";
