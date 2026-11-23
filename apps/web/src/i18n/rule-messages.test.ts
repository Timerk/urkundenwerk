import {
  checkRegisterFiling,
  type RuleCode,
  registerFilingMetadata,
  rulesFor,
} from "@urkundenwerk/core";
import { createTranslator } from "next-intl";
import { describe, expect, it } from "vitest";
import { LOCALES, type Locale } from "./locale";
import { MESSAGES } from "./messages";
import type { en } from "./messages/en";
import {
  ruleMessage,
  type RulesTranslator,
  ruleSummary,
} from "./rule-messages";

// The filing's rule set contains the deed's rules too, so this is every code.
const CODES = rulesFor(registerFilingMetadata.id).map(({ id }) => id);

/** A translator that fails the test on any missing key or argument. */
function strict(locale: Locale): RulesTranslator {
  return createTranslator({
    locale,
    messages: MESSAGES[locale] as typeof en,
    namespace: "rules",
    onError: (error) => {
      throw error;
    },
  }) as unknown as RulesTranslator;
}

// Every param any rule reports, so each variant can format its message.
const PARAMS = {
  shareCapitalCents: 2_000_000,
  minimumCents: 2_500_000,
  dueNowCents: 1_000_000,
  requiredCents: 1_250_000,
  costCapCents: 30_000,
  minimumAge: 18,
  thresholdDays: 30,
  paidCents: 500_000,
  dueCents: 2_500_000,
  capitalCents: 2_500_000,
};

// Paths and params that select each wording of a code.
const VARIANTS: {
  paths: string[];
  params: Record<string, number | boolean>;
}[] = [
  { paths: ["company.name"], params: PARAMS },
  { paths: ["contribution"], params: PARAMS },
  { paths: ["founder.birthDate"], params: PARAMS },
  { paths: ["shareCapitalCents"], params: PARAMS },
  { paths: ["filing.businessAddress.postalCode"], params: PARAMS },
  { paths: ["notarisation.date"], params: { ...PARAMS, inFuture: true } },
  { paths: ["filing.paidCents"], params: {} },
];

describe("rule messages", () => {
  it("know the rule codes of both templates", () => {
    expect(CODES).toContain("field_required");
    expect(CODES).toContain("filing_disclosure_instruction");
    expect(new Set(CODES).size).toBe(CODES.length);
  });

  describe.each(LOCALES)("in %s", (locale) => {
    const t = strict(locale);

    it.each(CODES)("word %s and its summary", (code: RuleCode) => {
      expect(MESSAGES[locale].rules).toHaveProperty(code);
      expect(ruleSummary(t, code)).not.toBe("");
      for (const variant of VARIANTS) {
        const message = ruleMessage(t, locale, { code, ...variant });
        expect(message).not.toBe("");
        expect(message).not.toMatch(/[{}]|rules\./);
      }
    });
  });

  it("format amounts and keep legal references", () => {
    const issue = {
      code: "gmbh_capital_minimum" as const,
      paths: ["shareCapitalCents"],
      params: PARAMS,
    };
    expect(ruleMessage(strict("de"), "de", issue)).toBe(
      "Eine GmbH benötigt ein Stammkapital von mindestens 25.000 €.",
    );
    expect(ruleMessage(strict("en"), "en", issue)).toBe(
      "A GmbH needs a Stammkapital of at least €25,000.",
    );
    expect(
      ruleMessage(strict("de"), "de", {
        code: "ug_contribution_full",
        paths: ["contribution"],
        params: {},
      }),
    ).toContain("(§ 5a Abs. 2 GmbHG)");
  });

  it("word the issues core reports for a real draft", () => {
    const issues = checkRegisterFiling(
      {
        company: { name: "Muster UG (haftungsbeschränkt)" },
        shareCapitalCents: 3_000_000,
        filing: { businessAddress: { postalCode: "123" } },
      },
      { referenceDate: "2026-11-24" },
    );
    const t = strict("de");
    const words = issues.map((issue) => ruleMessage(t, "de", issue));
    expect(words).toContain(
      "Geben Sie eine fünfstellige deutsche Postleitzahl ein.",
    );
    expect(words).toContain(
      "Eine UG (haftungsbeschränkt) hat ein Stammkapital von weniger als 25.000 €. Ab 25.000 € gründen Sie stattdessen eine GmbH.",
    );
  });
});
