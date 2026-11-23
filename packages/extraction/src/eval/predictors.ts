import type { LlmClient } from "@urkundenwerk/ai";
import { locateQuote } from "../citations";
import { extractDraftFields, type ExtractionReview } from "../llm/service";
import {
  extractionFieldPaths,
  isFieldValue,
  type ExtractedField,
  type ExtractionFieldPath,
  type ExtractionFieldValue,
  type Predictor,
} from "../result";
import type { GoldDocument } from "./gold";
import { normalizeSalutation } from "./score";

export function oracle(gold: GoldDocument): Predictor {
  return async (doc) => ({
    documentId: doc.id,
    fields: extractionFieldPaths.flatMap((path) => {
      const label = gold.fields[path];
      if (!label) return [];
      const citation = locateQuote(doc, label.quote);
      if (!citation) throw new Error(`Unlocatable oracle evidence for ${path}`);
      return [{ path, value: label.value, citation }];
    }),
  });
}

const numericEuro =
  /\bStammkapital\b[^\d.;]{0,40}?(EUR\s+)?(\d{1,3}(?:[. ]\d{3})+|\d+)(?:,(\d{2}))?(?![\d,])(?:\s*(EUR\b|€|Euro\b))?/iu;

/** A simple first-match heuristic. Gold labels are never provided to this predictor. */
export const regexBaseline: Predictor = async (doc) => {
  const text = doc.text.replace(/\s+/gu, " ");
  const fields: ExtractedField[] = [];
  const add = (
    path: ExtractionFieldPath,
    match: RegExpMatchArray | null,
    value: ExtractionFieldValue | undefined = match?.[1],
  ) => {
    if (!match || value === undefined || !isFieldValue(path, value)) return;
    fields.push({ path, value, citation: locateQuote(doc, match[0]) });
  };

  add(
    "company.name",
    text.match(
      /(?:unter der Firma|Die Firma(?: der Gesellschaft)? lautet|Firma:)\s+([^.;]{1,160}?\s(?:GmbH|(?:UG|Unternehmergesellschaft) \(haftungsbeschränkt\)))(?=\s|[.,;]|$)/iu,
    ),
  );
  add(
    "company.seat",
    text.match(/(?:mit dem Sitz in|Sitz ist|Sitz:)\s+([\p{L}-]{2,80})/iu),
  );
  add(
    "company.purpose",
    text.match(
      /(?:Gegenstand des Unternehmens ist|Unternehmensgegenstand ist|Gegenstand:)\s+([^.;]{1,300})/iu,
    ),
  );
  const capital = text.match(numericEuro);
  if (capital?.[1] || capital?.[4]) {
    const euros = capital[2]!.replace(/[. ]/gu, "");
    add(
      "shareCapitalCents",
      capital,
      Number(euros) * 100 + Number(capital[3] ?? 0),
    );
  }
  const subscription = text.match(
    /\b(sofort in voller Höhe|zu 50 Prozent sofort)\b/iu,
  );
  if (subscription)
    add(
      "contribution",
      subscription,
      /^sofort/iu.test(subscription[0]) ? "full" : "half",
    );

  const person = text.match(
    /\b(Herrn?|Frau)\s+([\p{L}-]+)\s+([\p{L}-]+),\s+geboren am/iu,
  );
  if (person) {
    add("founder.salutation", person, normalizeSalutation(person[1]!));
    add("founder.firstName", person, person[2]);
    add("founder.lastName", person, person[3]);
    add("founder.kind", person, "natural_person");
  }
  return { documentId: doc.id, fields };
};

export interface LlmPredictorOptions {
  client: LlmClient;
  model: string;
  effort?: "low" | "medium" | "high";
  /** Receives the full review of each document, for verified rates and cost. */
  onReview?: (review: ExtractionReview) => void;
}

/**
 * The LLM extraction pipeline as a predictor: the model proposes, our
 * grounding decides, and the scorer checks the result independently.
 */
export function llmPredictor({
  client,
  model,
  effort,
  onReview,
}: LlmPredictorOptions): Predictor {
  return async (doc) => {
    const review = await extractDraftFields(doc, { client, model, effort });
    onReview?.(review);
    return review.result;
  };
}
