import type { ExplanationItem } from "./payload";

/**
 * Identifies the wording of the prompts below. Change it whenever a prompt
 * or the output schema changes, so cached explanations are not reused.
 */
export const PROMPT_VERSION = "explain-2026-11-24";

/** The languages an explanation can be written in: the UI languages. */
export const EXPLANATION_LOCALES = ["de", "en"] as const;
export type ExplanationLocale = (typeof EXPLANATION_LOCALES)[number];

const BASE_PROMPT = `You explain the results of deterministic consistency checks in a German company-formation tool. The users are lawyers, notaries, and paralegals preparing a single-founder GmbH or UG with the statutory Musterprotokoll (Anlage 1 GmbHG).

Each issue you receive was already detected by a rule. The rule is authoritative: do not question whether the issue applies, do not add issues, and do not say the data is valid or invalid beyond what the rule states. You only see the rule, never the case data. The rule summaries are in English whatever the answer language.

For every issue, write:
- "explanation": at most three short sentences that say what the rule requires, why the law requires it, and what the given params mean for this case. Cite only the legal reference provided with the issue, unchanged.
- "suggestedFix": one short sentence that tells the user what to change in the form.

Amounts in params ending in "Cents" are euro cents; write them as euros.

Never draft or rephrase the text of the deed or any other legal document, and do not give legal advice beyond explaining the rule. Return exactly one entry per issue code, using the code unchanged.`;

// The answer language follows the UI. Each variant is a fixed string, so
// the provider's prompt cache still applies per language.
const LANGUAGE_PROMPTS: Record<ExplanationLocale, string> = {
  de: `Write both fields in German, as used in a German law firm or notary's office: plain, precise German that addresses the reader formally with "Sie". Use the statutory terms of art, such as Stammkapital, Firma, Gesellschafter, Geschäftsführer, Einlage, Unternehmensgegenstand, and Registergericht. Write amounts the German way, for example 2500000 as 25.000 €.`,
  en: `Write both fields in plain English. Keep German terms of art such as Stammkapital, Firma, or Geschäftsführer where they are precise. Write amounts as euros, for example 2500000 as 25,000 €.`,
};

/** The system prompt for explanations in one language. */
export function explanationSystemPrompt(locale: ExplanationLocale): string {
  return `${BASE_PROMPT}\n\n${LANGUAGE_PROMPTS[locale]}`;
}

/** The user turn: the issues as JSON data, not instructions. */
export function userMessage(
  templateId: string,
  locale: ExplanationLocale,
  items: readonly ExplanationItem[],
): string {
  const payload = JSON.stringify(
    { templateId, language: locale, issues: items },
    null,
    2,
  );
  return `Explain these rule check results.\n\n<issues>\n${payload}\n</issues>`;
}
