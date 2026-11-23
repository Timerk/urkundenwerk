import { mkdir, writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { z } from "zod";
import { extractionResultSchema } from "../src";
import {
  loadCorpus,
  oracle,
  regexBaseline,
  scoreEvaluation,
} from "../src/eval";
import { corpusRoot, splitSchema } from "../src/eval/corpus";

const argv = process.argv.slice(2);
const { values } = parseArgs({
  args: argv[0] === "--" ? argv.slice(1) : argv,
  options: {
    predictor: { type: "string", default: "regex-baseline" },
    split: { type: "string", default: "test" },
  },
});
const name = z.enum(["oracle", "regex-baseline"]).parse(values.predictor);
const split = splitSchema.parse(values.split);
const corpus = await loadCorpus(split);
const cases = [];
for (const item of corpus) {
  const predict = name === "oracle" ? oracle(item.gold) : regexBaseline;
  const prediction = extractionResultSchema.parse(await predict(item.source));
  cases.push({ ...item, prediction });
}
const score = scoreEvaluation(cases);
const report = { predictor: name, split, ...score };
const percent = (value: number) => `${(value * 100).toFixed(1)}%`;
type Metrics = typeof score.strict.micro;
const row = (name: string, strict: Metrics, lenient: Metrics) =>
  `| ${name} | ${[
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
const overview = [
  ...header,
  row("Micro", score.strict.micro, score.lenient.micro),
  row("Macro", score.strict.macro, score.lenient.macro),
];
const markdown = [
  `# ${name} · ${split} split`,
  "",
  `${corpus.length} documents, ${score.strict.counts.truePositive + score.strict.counts.falseNegative} labelled fields.`,
  "",
  ...overview,
  "",
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

const results = new URL("results/", corpusRoot);
await mkdir(results, { recursive: true });
const stem = `${name}-${split}`;
await Promise.all([
  writeFile(
    new URL(`${stem}.json`, results),
    JSON.stringify(report, null, 2) + "\n",
  ),
  writeFile(new URL(`${stem}.md`, results), markdown),
]);
console.log(overview.join("\n"));
console.log(`Reports written to eval/results/${stem}.{json,md}`);
