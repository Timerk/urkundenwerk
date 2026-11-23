import { FakeLlmClient, type FakeResponse } from "@urkundenwerk/ai";
import { describe, expect, it } from "vitest";
import { locateQuote } from "../citations";
import type { ExtractionReview } from "../llm/service";
import type { ExtractionOutput } from "../llm/prompt";
import { extractionFieldPaths, extractionResultSchema } from "../result";
import type { SourceDocument } from "../source";
import { loadCorpus } from "./corpus";
import type { GoldDocument } from "./gold";
import { llmPredictor } from "./predictors";
import { estimateCost, summarizeRun, type DocumentRun } from "./runs";
import { scoreEvaluation } from "./score";

// The full pipeline on corpus documents, with a scripted model that answers
// like a perfect extractor would. No test reaches the network.

/** A model answer built from gold labels: values as text, quotes as written. */
function scriptedAnswer(
  source: SourceDocument,
  gold: GoldDocument,
): ExtractionOutput {
  return {
    fields: extractionFieldPaths.flatMap((path) => {
      const label = gold.fields[path];
      if (!label) return [];
      const value =
        path === "shareCapitalCents"
          ? String(Number(label.value) / 100)
          : String(label.value);
      const segmentId = locateQuote(source, label.quote)!.segmentId;
      return [{ path, value, quote: label.quote, segmentId }];
    }),
    notes: [],
  };
}

describe("llmPredictor", async () => {
  const corpus = (await loadCorpus("dev")).filter(({ id }) =>
    ["02-kupferliest", "11-musterprotokoll"].includes(id),
  );

  async function evaluate(answers: FakeResponse[]) {
    const client = FakeLlmClient.scripted(answers);
    const reviews: DocumentRun[] = [];
    const cases = [];
    for (const item of corpus) {
      const predict = llmPredictor({
        client,
        model: "claude-haiku-5-5",
        onReview: (review) => reviews.push({ id: item.id, review }),
      });
      const prediction = extractionResultSchema.parse(
        await predict(item.source),
      );
      cases.push({ ...item, prediction });
    }
    const score = scoreEvaluation(cases);
    return { client, reviews, score };
  }

  it("scores a perfect scripted model at 100% with every value verified", async () => {
    const { client, reviews, score } = await evaluate(
      corpus.map(({ source, gold }) => ({
        kind: "output",
        output: scriptedAnswer(source, gold),
      })),
    );

    expect(client.requests).toHaveLength(2);
    for (const mode of [score.strict, score.lenient]) {
      expect(mode.counts.truePositive).toBeGreaterThan(20);
      expect(mode.micro).toMatchObject({
        precision: 1,
        recall: 1,
        citationAccuracy: 1,
      });
    }
    const summary = summarizeRun("claude-haiku-5-5", reviews, score);
    expect(summary).toMatchObject({
      documents: 2,
      failures: [],
      verifiedRate: 1,
      verifiedPrecision: 1,
    });
  });

  it("loses citation credit and the verified badge for a wrong quote", async () => {
    const [first, second] = corpus;
    const answer = scriptedAnswer(first!.source, first!.gold);
    const firma = answer.fields.find(({ path }) => path === "company.name")!;
    // A plausible but wrong passage: the value is right, the evidence is not.
    firma.quote = "Erschienener";
    firma.segmentId = "s1";

    const { reviews, score } = await evaluate([
      { kind: "output", output: answer },
      { kind: "output", output: scriptedAnswer(second!.source, second!.gold) },
    ]);

    const review = reviews[0]!.review as ExtractionReview;
    expect(
      review.fields.find(({ path }) => path === "company.name"),
    ).toMatchObject({ status: "unverified" });
    expect(score.strict.micro.precision).toBe(1);
    expect(score.strict.micro.citationAccuracy).toBeLessThan(1);
    const summary = summarizeRun("claude-haiku-5-5", reviews, score);
    expect(summary.verifiedRate).toBeLessThan(1);
    expect(summary.verifiedPrecision).toBe(1);
  });

  it("propagates a failed call so the runner can count the document", async () => {
    const { source } = corpus[0]!;
    const predict = llmPredictor({
      client: FakeLlmClient.scripted([{ kind: "error", error: "refused" }]),
      model: "claude-haiku-5-5",
    });
    await expect(predict(source)).rejects.toMatchObject({ code: "refused" });
  });
});

describe("run summaries", () => {
  it("estimates cost from list prices, cache reads included", () => {
    expect(
      estimateCost("claude-opus-5-5", {
        inputTokens: 1_000_000,
        outputTokens: 100_000,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 1_000_000,
      }),
    ).toBeCloseTo(4 + 2 + 0.2);
    expect(
      estimateCost("unknown-model", {
        inputTokens: 1,
        outputTokens: 1,
        cacheCreationInputTokens: 0,
        cacheReadInputTokens: 0,
      }),
    ).toBeNull();
  });

  it("counts failed documents and summarizes latency", () => {
    const score = scoreEvaluation([]);
    const review = (latencyMs: number) =>
      ({
        fields: [],
        latencyMs,
        usage: {
          inputTokens: 10,
          outputTokens: 5,
          cacheCreationInputTokens: 0,
          cacheReadInputTokens: 0,
        },
      }) as unknown as ExtractionReview;
    const summary = summarizeRun(
      "claude-sonnet-5-5",
      [
        { id: "a", review: review(1_000) },
        { id: "b", review: review(3_000) },
        { id: "c", failure: "The AI took too long to answer." },
      ],
      score,
    );
    expect(summary).toMatchObject({
      documents: 3,
      failures: [{ id: "c", reason: "The AI took too long to answer." }],
      latencyMs: { mean: 2_000, p50: 1_000, max: 3_000 },
      usage: { inputTokens: 20, outputTokens: 10 },
    });
  });
});
