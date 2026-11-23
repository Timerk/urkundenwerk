import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import {
  AnthropicLlmClient,
  FakeLlmClient,
  type LlmClient,
  OpenAiLlmClient,
  withResilience,
} from "@urkundenwerk/ai";
import { z } from "zod";
import {
  EXTRACTION_PROMPT_VERSION,
  EXTRACTION_SYSTEM_PROMPT,
  extractionResultSchema,
  extractionUserMessage,
  fakeExtractionResponder,
  type ExtractionResult,
  type Predictor,
} from "../src";
import {
  type DocumentRun,
  llmPredictor,
  loadCorpus,
  MODEL_PRICES,
  oracle,
  regexBaseline,
  type RunSummary,
  scoreEvaluation,
  splitSchema,
  summarizeRun,
} from "../src/eval";
import { corpusRoot } from "../src/eval/corpus";

// Usage (see the package README):
//   eval -- --predictor regex-baseline --split test
//   eval -- --predictor llm --model claude-opus-5-5 --model claude-haiku-5-5
//   eval -- --predictor llm --provider openai --model gpt-6.2-sol
//   eval -- --predictor llm --model claude-opus-5-5 --dry-run
// Develop prompts on the dev split only. The test split is for reporting.

const argv = process.argv.slice(2);
const { values } = parseArgs({
  args: argv[0] === "--" ? argv.slice(1) : argv,
  options: {
    predictor: { type: "string", multiple: true, default: ["regex-baseline"] },
    model: { type: "string", multiple: true, default: [] },
    provider: { type: "string", default: "anthropic" },
    split: { type: "string", default: "test" },
    effort: { type: "string", default: "medium" },
    concurrency: { type: "string", default: "4" },
    "timeout-ms": { type: "string", default: "180000" },
    "dry-run": { type: "boolean", default: false },
  },
});

const predictorNames = z
  .array(z.enum(["oracle", "regex-baseline", "fake", "llm"]))
  .parse(values.predictor);
const split = splitSchema.parse(values.split);
const provider = z.enum(["anthropic", "openai"]).parse(values.provider);
const effort = z.enum(["low", "medium", "high"]).parse(values.effort);
const concurrency = z.coerce
  .number()
  .int()
  .min(1)
  .max(16)
  .parse(values.concurrency);
const timeoutMs = z.coerce
  .number()
  .int()
  .min(10_000)
  .parse(values["timeout-ms"]);
const models = z
  .array(z.string().regex(/^[a-z0-9][a-z0-9.-]*$/u))
  .parse(values.model);
if (predictorNames.includes("llm") && models.length === 0) {
  throw new Error(
    "--predictor llm needs at least one --model, e.g. claude-opus-5-5.",
  );
}

const corpus = await loadCorpus(split);

if (values["dry-run"]) {
  // Rough sizes without calling the API. German text with segment ids runs
  // at about 3.2 characters per token; count_tokens gives exact numbers.
  const system = EXTRACTION_SYSTEM_PROMPT.length;
  const user = corpus.reduce(
    (sum, item) => sum + extractionUserMessage(item.source).length,
    0,
  );
  const tokens = (chars: number) => Math.ceil(chars / 3.2);
  console.log(
    `${corpus.length} documents. System prompt ${system} characters (~${tokens(system)} tokens, cached after the first request).`,
  );
  console.log(
    `Documents ${user} characters (~${tokens(user)} input tokens in total).`,
  );
  const outputPerDocument = 3_000;
  for (const model of models) {
    const price = MODEL_PRICES[model];
    if (!price) {
      console.log(`${model}: no price on record.`);
      continue;
    }
    const cost =
      (tokens(user) * price.input +
        tokens(system) *
          (price.cacheWrite + (corpus.length - 1) * price.cacheRead) +
        corpus.length * outputPerDocument * price.output) /
      1_000_000;
    console.log(
      `${model}: about $${cost.toFixed(2)} with ~${outputPerDocument} output tokens per document, thinking included.`,
    );
  }
  process.exit(0);
}

function providerClient(): LlmClient {
  // The key comes from the environment or from apps/web/.env.local, which Git
  // ignores. It is never printed.
  const variable =
    provider === "openai" ? "OPENAI_API_KEY" : "ANTHROPIC_API_KEY";
  const envFile = new URL("../../../apps/web/.env.local", import.meta.url);
  if (!process.env[variable] && existsSync(envFile)) {
    process.loadEnvFile(envFile);
  }
  const key = process.env[variable]?.trim();
  if (!key) {
    throw new Error(
      `Set ${variable} or add it to apps/web/.env.local to run --predictor llm --provider ${provider}.`,
    );
  }
  const client =
    provider === "openai"
      ? OpenAiLlmClient.fromApiKey(key)
      : AnthropicLlmClient.fromApiKey(key);
  return withResilience(client, { timeoutMs });
}

/** Runs `task` over `items`, the first one alone so later ones read its cache. */
async function pool<T, R>(
  items: readonly T[],
  limit: number,
  task: (item: T) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  if (items.length === 0) return results;
  results[0] = await task(items[0]!);
  let next = 1;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length - 1) }, async () => {
      while (next < items.length) {
        const index = next++;
        results[index] = await task(items[index]!);
      }
    }),
  );
  return results;
}

type Run = {
  name: string;
  predictor: string;
  model: string | null;
  summary: RunSummary | null;
  score: ReturnType<typeof scoreEvaluation>;
};

/**
 * Scores one predictor on the split. An LLM run passes `llm`: its reviews
 * arrive through `onReview`, a failed document is recorded and counts as
 * predicting nothing, and the run gets a summary of cost and grounding.
 */
async function evaluate(
  name: string,
  predictor: string,
  predict: (item: (typeof corpus)[number]) => Predictor,
  llm?: { client: LlmClient; model: string; reviews: DocumentRun[] },
): Promise<Run> {
  const predictions = await pool(
    corpus,
    llm ? concurrency : 1,
    async (item) => {
      let prediction: ExtractionResult;
      try {
        prediction = extractionResultSchema.parse(
          await predict(item)(item.source),
        );
      } catch (error) {
        if (!llm) throw error;
        const reason = error instanceof Error ? error.message : String(error);
        llm.reviews.push({ id: item.id, failure: reason });
        console.error(`\n${name} ${item.id}: ${reason}`);
        prediction = { documentId: item.source.id, fields: [] };
      }
      process.stderr.write(".");
      return { ...item, prediction };
    },
  );
  process.stderr.write("\n");
  const score = scoreEvaluation(predictions);
  const summary = llm ? summarizeRun(llm.model, llm.reviews, score) : null;
  return { name, predictor, model: llm?.model ?? null, score, summary };
}

const runs: Run[] = [];
for (const predictorName of predictorNames) {
  if (predictorName === "oracle") {
    runs.push(await evaluate("oracle", "oracle", (item) => oracle(item.gold)));
  } else if (predictorName === "regex-baseline") {
    runs.push(
      await evaluate("regex-baseline", "regex-baseline", () => regexBaseline),
    );
  } else {
    const fake = predictorName === "fake";
    const client = fake
      ? new FakeLlmClient(fakeExtractionResponder)
      : providerClient();
    for (const model of fake ? ["fake-model"] : models) {
      const reviews: DocumentRun[] = [];
      runs.push(
        await evaluate(
          fake ? "fake" : `llm-${model}`,
          predictorName,
          (item) =>
            llmPredictor({
              client,
              model,
              effort,
              onReview: (review) => reviews.push({ id: item.id, review }),
            }),
          { client, model, reviews },
        ),
      );
    }
  }
}

const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
type Metrics = Run["score"]["strict"]["micro"];
const row = (label: string, strict: Metrics, lenient: Metrics) =>
  `| ${label} | ${[
    strict.precision,
    strict.recall,
    strict.f1,
    lenient.precision,
    lenient.recall,
    lenient.f1,
    strict.citationAccuracy,
    lenient.citationAccuracy,
    strict.groundedRecall,
    lenient.groundedRecall,
  ]
    .map(percent)
    .join(" | ")} |`;
const header = [
  "| Scope | Strict precision | Strict recall | Strict F1 | Lenient precision | Lenient recall | Lenient F1 | Strict citation accuracy | Lenient citation accuracy | Strict grounded recall | Lenient grounded recall |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
];

function runMarkdown({ name, score, summary }: Run) {
  const labelled =
    score.strict.counts.truePositive + score.strict.counts.falseNegative;
  return [
    `# ${name} · ${split} split`,
    "",
    `${corpus.length} documents, ${labelled} labelled fields. Prompt ${EXTRACTION_PROMPT_VERSION}${summary ? `, effort ${effort}` : ""}.`,
    "",
    ...header,
    row("Micro", score.strict.micro, score.lenient.micro),
    row("Macro", score.strict.macro, score.lenient.macro),
    "",
    ...(summary
      ? [
          `Verified rate ${percent(summary.verifiedRate)}, verified precision ${percent(summary.verifiedPrecision)}, ${summary.failures.length} failed documents.`,
          `Latency per document: mean ${(summary.latencyMs.mean / 1000).toFixed(1)} s, median ${(summary.latencyMs.p50 / 1000).toFixed(1)} s, max ${(summary.latencyMs.max / 1000).toFixed(1)} s.`,
          `Tokens: ${summary.usage.inputTokens} input, ${summary.usage.cacheCreationInputTokens} cache write, ${summary.usage.cacheReadInputTokens} cache read, ${summary.usage.outputTokens} output. Estimated cost ${summary.costUsd === null ? "unknown" : `$${summary.costUsd.toFixed(2)}`}.`,
          "",
        ]
      : []),
    "## Per field",
    "",
    ...header,
    ...score.strict.fields.map(({ path, metrics }, index) =>
      row(`\`${path}\``, metrics, score.lenient.fields[index]!.metrics),
    ),
    "",
    "## Per document",
    "",
    ...header,
    ...score.strict.documents.map(({ id, metrics }, index) =>
      row(id, metrics, score.lenient.documents[index]!.metrics),
    ),
    "",
  ].join("\n");
}

const comparison = [
  "| Predictor | Strict P | Strict R | Strict F1 | Lenient F1 | Citation accuracy | Grounded recall | Verified rate | Verified precision | Failed | Median latency | Tokens in / out | Est. cost |",
  "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
  ...runs.map(({ name, score, summary }) => {
    const { micro } = score.strict;
    const llm = summary
      ? [
          percent(summary.verifiedRate),
          percent(summary.verifiedPrecision),
          String(summary.failures.length),
          `${(summary.latencyMs.p50 / 1000).toFixed(1)} s`,
          `${(
            summary.usage.inputTokens +
            summary.usage.cacheCreationInputTokens +
            summary.usage.cacheReadInputTokens
          ).toLocaleString(
            "en-US",
          )} / ${summary.usage.outputTokens.toLocaleString("en-US")}`,
          summary.costUsd === null ? "—" : `$${summary.costUsd.toFixed(2)}`,
        ]
      : ["—", "—", "—", "—", "—", "—"];
    return `| ${name} | ${[
      micro.precision,
      micro.recall,
      micro.f1,
      score.lenient.micro.f1,
      micro.citationAccuracy,
      micro.groundedRecall,
    ]
      .map(percent)
      .join(" | ")} | ${llm.join(" | ")} |`;
  }),
];

const results = new URL("results/", corpusRoot);
await mkdir(results, { recursive: true });
for (const run of runs) {
  const stem = `${run.name}-${split}`;
  const report = {
    predictor: run.predictor,
    model: run.model,
    split,
    promptVersion: run.summary ? EXTRACTION_PROMPT_VERSION : null,
    effort: run.summary ? effort : null,
    summary: run.summary,
    ...run.score,
  };
  await writeFile(
    new URL(`${stem}.json`, results),
    JSON.stringify(report, null, 2) + "\n",
  );
  await writeFile(new URL(`${stem}.md`, results), runMarkdown(run));
}
await writeFile(
  new URL(`comparison-${split}.md`, results),
  [
    `Micro averages on the ${split} split (${corpus.length} documents), prompt ${EXTRACTION_PROMPT_VERSION}, effort ${effort}.`,
    "",
    ...comparison,
    "",
  ].join("\n"),
);
console.log(comparison.join("\n"));
console.log(
  `Reports written to eval/results/ (comparison-${split}.md and one file per run).`,
);
