import type { LlmUsage } from "@urkundenwerk/ai";
import type { ExtractionReview } from "../llm/service";
import type { EvaluationScore } from "./score";

export interface ModelPrice {
  /** US dollars per million tokens. */
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

/**
 * List prices for cost estimates, in US dollars per million tokens, as
 * published by Anthropic and OpenAI in November 2026. Anthropic charges 1.25
 * times the input price to write the five-minute prompt cache; OpenAI caches
 * automatically and charges writes as normal input. Check current prices
 * before relying on an estimate.
 */
export const MODEL_PRICES: Readonly<Record<string, ModelPrice>> = {
  "claude-opus-5-5": { input: 4, output: 20, cacheWrite: 5, cacheRead: 0.2 },
  "claude-sonnet-5-5": {
    input: 2,
    output: 10,
    cacheWrite: 2.5,
    cacheRead: 0.1,
  },
  "claude-haiku-5-5": {
    input: 0.1,
    output: 0.5,
    cacheWrite: 0.125,
    cacheRead: 0.01,
  },
  "gpt-6.2-sol": { input: 2, output: 10, cacheWrite: 2, cacheRead: 0.1 },
  "gpt-6.1-terra": { input: 1, output: 5, cacheWrite: 1, cacheRead: 0.05 },
  "gpt-6-luna": { input: 0.1, output: 0.5, cacheWrite: 0.1, cacheRead: 0.01 },
};

/** The estimated cost of the usage in US dollars, or `null` for unknown models. */
export function estimateCost(model: string, usage: LlmUsage): number | null {
  const price = MODEL_PRICES[model];
  if (!price) return null;
  return (
    (usage.inputTokens * price.input +
      usage.outputTokens * price.output +
      usage.cacheCreationInputTokens * price.cacheWrite +
      usage.cacheReadInputTokens * price.cacheRead) /
    1_000_000
  );
}

/** One document of an LLM run: its review, or why it failed. */
export type DocumentRun = { id: string } & (
  | { review: ExtractionReview; failure?: undefined }
  | { review?: undefined; failure: string }
);

export interface RunSummary {
  documents: number;
  failures: { id: string; reason: string }[];
  /** Predicted fields that our grounding verified, of all predicted fields. */
  verifiedRate: number;
  /** Verified fields whose value is strictly correct, of all verified fields. */
  verifiedPrecision: number;
  latencyMs: { mean: number; p50: number; max: number };
  usage: LlmUsage;
  costUsd: number | null;
}

function ratio(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : numerator / denominator;
}

/**
 * Summarizes an LLM run next to its score: how often the grounding verified
 * a prediction, how often a verified value was right, latency, tokens, and
 * an estimated cost.
 */
export function summarizeRun(
  model: string,
  runs: readonly DocumentRun[],
  score: EvaluationScore,
): RunSummary {
  let predicted = 0;
  let verified = 0;
  let verifiedCorrect = 0;
  const latencies: number[] = [];
  const usage: LlmUsage = {
    inputTokens: 0,
    outputTokens: 0,
    cacheCreationInputTokens: 0,
    cacheReadInputTokens: 0,
  };
  const failures: RunSummary["failures"] = [];

  for (const run of runs) {
    if (!run.review) {
      failures.push({ id: run.id, reason: run.failure });
      continue;
    }
    const scored = score.strict.documents.find((doc) => doc.id === run.id);
    for (const field of run.review.fields) {
      if (field.status === "absent" || field.value === null) continue;
      predicted++;
      if (field.status !== "verified") continue;
      verified++;
      const status = scored?.fields.find(
        ({ path }) => path === field.path,
      )?.status;
      if (status === "correct") verifiedCorrect++;
    }
    latencies.push(run.review.latencyMs);
    for (const key of Object.keys(usage) as (keyof LlmUsage)[]) {
      usage[key] += run.review.usage[key];
    }
  }

  const sorted = [...latencies].sort((a, b) => a - b);
  return {
    documents: runs.length,
    failures,
    verifiedRate: ratio(verified, predicted),
    verifiedPrecision: ratio(verifiedCorrect, verified),
    latencyMs: {
      mean: ratio(
        latencies.reduce((sum, value) => sum + value, 0),
        latencies.length,
      ),
      p50: sorted[Math.floor((sorted.length - 1) / 2)] ?? 0,
      max: sorted.at(-1) ?? 0,
    },
    usage,
    costUsd: estimateCost(model, usage),
  };
}
