import { describe, expect, it } from "vitest";
import { locateQuote } from "../citations";
import {
  extractionFieldPaths,
  extractionResultSchema,
  type ExtractedField,
  type ExtractionFieldPath,
} from "../result";
import type { SourceDocument } from "../source";
import { loadCorpus } from "./corpus";
import { anchorGoldEvidence, goldDocumentSchema, type GoldValue } from "./gold";
import { oracle, regexBaseline } from "./predictors";
import { normalizeSalutation, scoreEvaluation } from "./score";

const text =
  "Firma ist Wölkchen GmbH. Der Sitz ist Wollquell. Werkstatt: Doldenbrück. Kapital: 25.000 EUR. Gegenstand ist die Wartung kleiner Pumpen. Register: HRB 12345.";
const doc: SourceDocument = {
  id: "a".repeat(64),
  format: "docx",
  text,
  segments: [{ id: "s1", kind: "paragraph", start: 0, end: text.length, text }],
};

function gold(labels: Partial<Record<ExtractionFieldPath, GoldValue>>) {
  return goldDocumentSchema.parse({
    fields: Object.fromEntries(
      extractionFieldPaths.map((path) => [path, labels[path] ?? null]),
    ),
  });
}

describe("scoreEvaluation", () => {
  it("scores correct, wrong, missed, spurious and absent fields with independent evidence checks", () => {
    const fields: ExtractedField[] = [
      {
        path: "company.name",
        value: "wo\u0308lkchen   gmbh",
        citation: locateQuote(doc, "Wölkchen GmbH"),
      },
      {
        path: "company.seat",
        value: "Doldenbrück",
        citation: locateQuote(doc, "Doldenbrück"),
      },
      { path: "founder.salutation", value: null, citation: null },
      {
        path: "shareCapitalCents",
        value: 2_500_000,
        citation: locateQuote(doc, "Der Sitz ist Wollquell"),
      },
    ];
    const { strict: score, lenient } = scoreEvaluation([
      {
        id: "one",
        source: doc,
        gold: gold({
          "company.name": {
            value: "Wölkchen GmbH",
            quote: "Firma ist Wölkchen GmbH",
          },
          "company.seat": {
            value: "Wollquell",
            quote: "Der Sitz ist Wollquell",
          },
          "company.purpose": {
            value: "Werkstatt",
            quote: "Werkstatt: Doldenbrück",
          },
          shareCapitalCents: { value: 2_500_000, quote: "Kapital: 25.000 EUR" },
        }),
        prediction: extractionResultSchema.parse({
          documentId: doc.id,
          fields,
        }),
      },
    ]);
    expect(lenient).toEqual(score);
    expect(score.counts).toEqual({
      truePositive: 2,
      falsePositive: 2,
      falseNegative: 2,
      citationHits: 1,
    });
    expect(score.micro).toEqual({
      precision: 1 / 2,
      recall: 1 / 2,
      f1: 1 / 2,
      citationAccuracy: 1 / 2,
      groundedRecall: 1 / 4,
    });
    expect(score.macro).toEqual({
      precision: 2 / 5,
      recall: 2 / 5,
      f1: 2 / 5,
      citationAccuracy: 1 / 5,
      groundedRecall: 1 / 5,
    });
    expect(score.documents[0]?.metrics).toEqual(score.micro);
    expect(
      score.documents[0]?.fields.find(({ path }) => path === "company.seat")
        ?.status,
    ).toBe("wrong");
    expect(
      score.documents[0]?.fields.find(
        ({ path }) => path === "founder.salutation",
      )?.status,
    ).toBe("spurious");
    expect(
      score.documents[0]?.fields.find(({ path }) => path === "notaryNotes")
        ?.status,
    ).toBe("absent");
    expect(
      score.documents[0]?.fields.find(({ path }) => path === "company.purpose")
        ?.status,
    ).toBe("missed");
  });

  it("rejects invalid citations and handles empty evaluation denominators", () => {
    const evidence = locateQuote(doc, "Wölkchen GmbH")!;
    const { strict: score } = scoreEvaluation([
      {
        id: "falsified",
        source: doc,
        gold: gold({
          "company.name": { value: "Wölkchen GmbH", quote: "Wölkchen GmbH" },
        }),
        prediction: {
          documentId: doc.id,
          fields: [
            {
              path: "company.name",
              value: "Wölkchen GmbH",
              citation: { ...evidence, quote: "altered" },
            },
          ],
        },
      },
    ]);
    expect(score.micro.f1).toBe(1);
    expect(score.micro.citationAccuracy).toBe(0);
    expect(scoreEvaluation([]).strict.macro).toEqual({
      precision: 0,
      recall: 0,
      f1: 0,
      citationAccuracy: 0,
      groundedRecall: 0,
    });
    expect(normalizeSalutation(" HERRN ")).toBe("Herr");
    expect(normalizeSalutation("FRAU")).toBe("Frau");
    expect(normalizeSalutation("unbekannt")).toBeUndefined();
  });

  it("accepts a free-text variation only in lenient mode and keeps register identifiers strict", () => {
    const purpose = "die Wartung kleiner Pumpen";
    const { strict, lenient } = scoreEvaluation([
      {
        id: "free-text",
        source: doc,
        gold: gold({
          "company.purpose": { value: purpose, quote: purpose },
          "founder.registerNumber": {
            value: "HRB 12345",
            quote: "Register: HRB 12345",
          },
        }),
        prediction: {
          documentId: doc.id,
          fields: [
            {
              path: "company.purpose",
              value: "Wartung kleiner Pumpen.",
              citation: locateQuote(doc, purpose),
            },
            {
              path: "founder.registerNumber",
              value: "HRB-12345",
              citation: locateQuote(doc, "HRB 12345"),
            },
          ],
        },
      },
    ]);
    expect(strict.counts).toEqual({
      truePositive: 0,
      falsePositive: 2,
      falseNegative: 2,
      citationHits: 0,
    });
    expect(lenient.counts).toEqual({
      truePositive: 1,
      falsePositive: 1,
      falseNegative: 1,
      citationHits: 1,
    });
  });

  it("rejects a paraphrased gold value even when its evidence locates", () => {
    expect(() =>
      anchorGoldEvidence(doc, "company.purpose", {
        value: "Wartung von kleinen Pumpen",
        quote: "die Wartung kleiner Pumpen",
      }),
    ).toThrow(/must be verbatim/u);
  });
});

describe("committed evaluation corpus", () => {
  it.each([
    ["dev", 8],
    ["test", 16],
    ["adversarial", 1],
  ] as const)(
    "validates %s draft labels and evidence and scores the oracle at 100%%",
    async (split, count) => {
      const corpus = await loadCorpus(split);
      expect(corpus).toHaveLength(count);
      expect(new Set(corpus.map(({ source }) => source.id)).size).toBe(count);
      const cases = await Promise.all(
        corpus.map(async (item) => {
          const prediction = extractionResultSchema.parse(
            await oracle(item.gold)(item.source),
          );
          const baseline = extractionResultSchema.parse(
            await regexBaseline(item.source),
          );
          expect(baseline.documentId).toBe(item.source.id);
          return { ...item, prediction };
        }),
      );
      const report = scoreEvaluation(cases);
      const perfect = {
        precision: 1,
        recall: 1,
        f1: 1,
        citationAccuracy: 1,
        groundedRecall: 1,
      };
      for (const mode of [report.strict, report.lenient]) {
        expect(mode.counts.truePositive).toBeGreaterThan(0);
        expect(mode.micro).toEqual(perfect);
        expect(mode.macro).toEqual(perfect);
      }
    },
  );
});
