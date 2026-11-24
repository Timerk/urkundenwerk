import type { IssueParams, RuleCode } from "@urkundenwerk/core";
import { useLocale, useTranslations } from "next-intl";
import { formatEuroCents } from "./format";
import type { Locale } from "./locale";

/*
 * Rule issues from core carry a stable code, params, and paths, and no text
 * for the UI (ADR-0012). This maps them to sentences in the UI language.
 * Legal references stay as the rules state them. `rule-messages.test.ts`
 * fails when a rule code has no message in either catalogue.
 */

export type RulesTranslator = ReturnType<typeof useTranslations<"rules">>;

/** What a message depends on: never the free text of a draft. */
export type IssueFacts = {
  code: RuleCode;
  params: IssueParams;
  paths: readonly string[];
};

// Paths whose schema is a choice or a date. The field rules word their
// message by the kind of field, as core's structural messages do.
const CHOICE_PATHS: ReadonlySet<string> = new Set([
  "notarisation.mode",
  "founder.kind",
  "founder.salutation",
  "contribution",
  "managingDirector.kind",
  "managingDirector.salutation",
]);
const DATE_PATHS: ReadonlySet<string> = new Set([
  "notarisation.date",
  "founder.birthDate",
  "managingDirector.birthDate",
]);

function cents(params: IssueParams, key: string): number {
  const value = params[key];
  return typeof value === "number" ? value : 0;
}

function count(params: IssueParams, key: string): number {
  const value = params[key];
  return typeof value === "number" ? value : 0;
}

/** The sentence shown for an issue, next to its field and in the Checks panel. */
export function ruleMessage(
  t: RulesTranslator,
  locale: Locale,
  { code, params, paths }: IssueFacts,
): string {
  const path = paths[0] ?? "";
  const euros = (key: string) => formatEuroCents(locale, cents(params, key));
  switch (code) {
    case "field_required":
      return CHOICE_PATHS.has(path)
        ? t("field_required.choice")
        : t("field_required.required");
    case "field_invalid":
      if (CHOICE_PATHS.has(path)) return t("field_invalid.choice");
      if (DATE_PATHS.has(path)) return t("field_invalid.date");
      if (path === "shareCapitalCents") return t("field_invalid.amount");
      return t("field_invalid.required");
    case "company_legal_form_suffix":
      return t("company_legal_form_suffix.message");
    case "share_capital_whole_euros":
      return t("share_capital_whole_euros.message");
    case "gmbh_capital_minimum":
      return t("gmbh_capital_minimum.message", {
        minimum: euros("minimumCents"),
      });
    case "ug_capital_below_gmbh_minimum":
      return t("ug_capital_below_gmbh_minimum.message", {
        minimum: euros("minimumCents"),
      });
    case "ug_contribution_full":
      return t("ug_contribution_full.message");
    case "contribution_minimum_payment":
      return t("contribution_minimum_payment.message", {
        required: euros("requiredCents"),
      });
    case "formation_costs_capped":
      return t("formation_costs_capped.message", {
        cap: euros("costCapCents"),
      });
    case "company_purpose_specific":
      return t("company_purpose_specific.message");
    case "director_founder_natural_person":
      return t("director_founder_natural_person.message");
    case "director_full_age":
      return t("director_full_age.message", {
        age: count(params, "minimumAge"),
      });
    case "founder_minor":
      return t("founder_minor.message", { age: count(params, "minimumAge") });
    case "birth_date_not_in_future":
      return t("birth_date_not_in_future.message");
    case "notarisation_date_plausible":
      return params.inFuture === true
        ? t("notarisation_date_plausible.future")
        : t("notarisation_date_plausible.past", {
            days: count(params, "thresholdDays"),
          });
    case "filing_court_required":
      return t("filing_court_required.message");
    case "filing_business_address":
      return path === "filing.businessAddress.postalCode"
        ? t("filing_business_address.postcode")
        : t("filing_business_address.address");
    case "filing_payment_minimum":
      // Without params, the amount itself is missing or out of range.
      return "minimumCents" in params
        ? t("filing_payment_minimum.below", { minimum: euros("minimumCents") })
        : t("filing_payment_minimum.missing");
    case "filing_payment_matches_deed":
      return t("filing_payment_matches_deed.message", {
        due: euros("dueCents"),
        capital: euros("capitalCents"),
      });
    case "filing_director_appointed_in_deed":
      return t("filing_director_appointed_in_deed.message");
    case "filing_funds_at_free_disposal":
      return t("filing_funds_at_free_disposal.message");
    case "filing_no_disqualification":
      return t("filing_no_disqualification.message");
    case "filing_disclosure_instruction":
      return t("filing_disclosure_instruction.message");
  }
}

/** The rule's own one-sentence statement, shown when no model explains it. */
export function ruleSummary(t: RulesTranslator, code: RuleCode): string {
  return t(`${code}.summary`);
}

/** Rule messages and summaries in the UI language, for components. */
export function useRuleMessages() {
  const t = useTranslations("rules");
  const locale = useLocale();
  return {
    message: (issue: IssueFacts) => ruleMessage(t, locale, issue),
    summary: (code: RuleCode) => ruleSummary(t, code),
  };
}
