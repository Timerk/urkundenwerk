import { verifyCitation } from "../citations";
import {
  extractionFieldPaths,
  type ExtractionFieldPath,
  type ExtractionFieldValue,
  type ExtractionResult,
} from "../result";
import { normalizeText, type SourceDocument } from "../source";
import { matchesFreeText } from "./free-text";
import { anchorGoldEvidence, isFreeTextField, type GoldDocument } from "./gold";

export interface EvaluationCase {
  id: string;
  source: SourceDocument;
  gold: GoldDocument;
  prediction: ExtractionResult;
}

interface Counts {
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  citationHits: number;
}

const emptyCounts = (): Counts => ({
  truePositive: 0,
  falsePositive: 0,
  falseNegative: 0,
  citationHits: 0,
});

function add(total: Counts, counts: Counts) {
  total.truePositive += counts.truePositive;
  total.falsePositive += counts.falsePositive;
  total.falseNegative += counts.falseNegative;
  total.citationHits += counts.citationHits;
}

function ratio(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function metrics(counts: Counts) {
  const { truePositive, falsePositive, falseNegative, citationHits } = counts;
  return {
    precision: ratio(truePositive, truePositive + falsePositive),
    recall: ratio(truePositive, truePositive + falseNegative),
    f1: ratio(
      2 * truePositive,
      2 * truePositive + falsePositive + falseNegative,
    ),
    citationAccuracy: ratio(citationHits, truePositive),
    groundedRecall: ratio(citationHits, truePositive + falseNegative),
  };
}

export function normalizeSalutation(text: string): "Herr" | "Frau" | undefined {
  switch (normalizeText(text).toLowerCase()) {
    case "herr":
    case "herrn":
      return "Herr";
    case "frau":
      return "Frau";
  }
}

function comparableValue(
  path: ExtractionFieldPath,
  value: ExtractionFieldValue,
) {
  if (typeof value !== "string") return value;
  if (path.endsWith(".salutation")) return normalizeSalutation(value);
  return normalizeText(value).toLowerCase();
}

function compareDocument({ id, source, gold, prediction }: EvaluationCase) {
  if (prediction.documentId !== source.id) {
    throw new Error(`${id}: prediction belongs to a different document`);
  }
  const predictions = new Map(
    prediction.fields.map((field) => [field.path, field]),
  );
  const fields = extractionFieldPaths.map((path) => {
    const expected = gold.fields[path];
    const predicted = predictions.get(path) ?? null;
    const strict = Boolean(
      expected &&
      predicted &&
      comparableValue(path, expected.value) ===
        comparableValue(path, predicted.value),
    );
    const lenient =
      strict ||
      (isFreeTextField(path) &&
        typeof expected?.value === "string" &&
        typeof predicted?.value === "string" &&
        matchesFreeText(expected.value, predicted.value));
    const evidence = expected
      ? anchorGoldEvidence(source, path, expected)
      : null;
    const citation = predicted?.citation;
    const overlaps = Boolean(
      evidence &&
      citation &&
      verifyCitation(source, citation) &&
      citation.start < evidence.end &&
      evidence.start < citation.end,
    );
    return { path, expected, predicted, overlaps, strict, lenient };
  });
  return { id, documentId: source.id, fields };
}

function scoreDocument(
  document: ReturnType<typeof compareDocument>,
  mode: "strict" | "lenient",
) {
  const counts = emptyCounts();
  const fields = document.fields.map((field) => {
    const { path, expected, predicted, overlaps } = field;
    const correct = field[mode];
    const citationHit = correct && overlaps;
    const fieldCounts = {
      truePositive: Number(correct),
      falsePositive: Number(Boolean(predicted) && !correct),
      falseNegative: Number(Boolean(expected) && !correct),
      citationHits: Number(citationHit),
    };
    add(counts, fieldCounts);
    return {
      path,
      status: correct
        ? "correct"
        : expected
          ? predicted
            ? "wrong"
            : "missed"
          : predicted
            ? "spurious"
            : "absent",
      expected,
      predicted,
      citationHit,
      counts: fieldCounts,
    };
  });
  return {
    id: document.id,
    documentId: document.documentId,
    counts,
    metrics: metrics(counts),
    fields,
  };
}

function summarize(
  evaluated: readonly ReturnType<typeof compareDocument>[],
  mode: "strict" | "lenient",
) {
  const counts = emptyCounts();
  const byPath = new Map(
    extractionFieldPaths.map((path) => [path, emptyCounts()]),
  );
  const documents = evaluated.map((item) => {
    const report = scoreDocument(item, mode);
    add(counts, report.counts);
    for (const field of report.fields)
      add(byPath.get(field.path)!, field.counts);
    return report;
  });
  const fields = extractionFieldPaths.map((path) => {
    const fieldCounts = byPath.get(path)!;
    return { path, counts: fieldCounts, metrics: metrics(fieldCounts) };
  });
  const active = fields.filter(
    ({ counts }) =>
      counts.truePositive + counts.falsePositive + counts.falseNegative > 0,
  );
  const macro = {
    precision: ratio(
      active.reduce((sum, field) => sum + field.metrics.precision, 0),
      active.length,
    ),
    recall: ratio(
      active.reduce((sum, field) => sum + field.metrics.recall, 0),
      active.length,
    ),
    f1: ratio(
      active.reduce((sum, field) => sum + field.metrics.f1, 0),
      active.length,
    ),
    citationAccuracy: ratio(
      active.reduce((sum, field) => sum + field.metrics.citationAccuracy, 0),
      active.length,
    ),
    groundedRecall: ratio(
      active.reduce((sum, field) => sum + field.metrics.groundedRecall, 0),
      active.length,
    ),
  };
  return { counts, micro: metrics(counts), macro, fields, documents };
}

/** Scores validated predictions and already ingested documents without I/O. */
export function scoreEvaluation(cases: readonly EvaluationCase[]) {
  const evaluated = cases.map(compareDocument);
  return {
    strict: summarize(evaluated, "strict"),
    lenient: summarize(evaluated, "lenient"),
  };
}

export type EvaluationScore = ReturnType<typeof scoreEvaluation>;
