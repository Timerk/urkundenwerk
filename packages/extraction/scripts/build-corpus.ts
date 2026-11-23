import { writeFile } from "node:fs/promises";
import {
  buildMusterprotokoll,
  formatGermanDate,
  inlineRunText,
  musterprotokollSchema,
  type DocumentModel,
} from "@urkundenwerk/core";
import { renderDocx, renderPdf } from "@urkundenwerk/render";
import { z } from "zod";
import {
  extractionFieldPaths,
  ingestDocument,
  locateQuote,
  type ExtractionFieldPath,
  type ExtractionFieldValue,
  type SourceDocument,
} from "../src";
import {
  corpusDirectories,
  formatSchema,
  readJson,
  splitSchema,
} from "../src/eval/corpus";
import {
  anchorGoldEvidence,
  goldDocumentSchema,
  type GoldValue,
} from "../src/eval/gold";
import { extractionFieldPathSchema } from "../src/result";

const sourceSchema = z.union([
  z.strictObject({
    kind: z.literal("musterprotokoll"),
    format: formatSchema,
    input: musterprotokollSchema,
  }),
  z.strictObject({
    kind: z.enum(["contract", "minutes"]),
    format: formatSchema,
    title: z.string(),
    paragraphs: z.array(z.string()).min(1),
    labels: z.partialRecord(
      extractionFieldPathSchema,
      z.tuple([z.union([z.string(), z.int()]), z.string()]),
    ),
  }),
]);

function authoredModel(
  source: Extract<
    z.infer<typeof sourceSchema>,
    { kind: "contract" | "minutes" }
  >,
): DocumentModel {
  return {
    templateId: "fictional-eval",
    templateVersion: "1",
    title: source.title,
    blocks: [
      { kind: "heading", runs: [{ kind: "text", text: source.title }] },
      ...source.paragraphs.map((text) => ({
        kind: "paragraph" as const,
        runs: [{ kind: "text" as const, text }],
      })),
    ],
  };
}

function draftValue(
  input: unknown,
  path: ExtractionFieldPath,
): ExtractionFieldValue | undefined {
  const value = path.split(".").reduce<unknown>((parent, key) => {
    return parent !== null && typeof parent === "object"
      ? (parent as Record<string, unknown>)[key]
      : undefined;
  }, input);
  if (value === null || typeof value === "string" || typeof value === "number")
    return value;
}

function statutoryLabels(
  input: z.infer<typeof musterprotokollSchema>,
  model: DocumentModel,
  source: SourceDocument,
) {
  const evidence = new Map<ExtractionFieldPath, string[]>();
  for (const block of model.blocks) {
    if (block.kind === "signatures") continue;
    const runs = block.runs.map(inlineRunText);
    block.runs.forEach((run, index) => {
      if (run.kind !== "field") return;
      const path = extractionFieldPathSchema.parse(run.path);
      const quote = run.text;
      const before = runs.slice(0, index).join("");
      const after = runs.slice(index + 1).join("");
      const contextual = [
        quote,
        before.split(/\s+/u).slice(-5).join(" ") + quote,
        quote + after.split(/\s+/u).slice(0, 5).join(" "),
        before + quote + after,
      ];
      evidence.set(path, [...(evidence.get(path) ?? []), ...contextual]);
    });
  }
  const { founder, managingDirector } = input;
  if (input.notarisation.mode === "in_person") {
    evidence.set("notarisation.mode", [
      "Vorgelesen, genehmigt und eigenhändig unterschrieben:",
    ]);
  }
  const identity =
    founder.kind === "legal_entity"
      ? `${founder.name}, mit Sitz in`
      : `${founder.firstName} ${founder.lastName}, geboren am ${formatGermanDate(founder.birthDate)}, wohnhaft in ${founder.address.street}`;
  evidence.set("founder.kind", [identity]);
  const appointee =
    managingDirector.kind === "other" ? managingDirector : founder;
  if (appointee.kind === "legal_entity")
    throw new Error("Unexpected legal entity as director");
  evidence.set("managingDirector.kind", [
    `Zum Geschäftsführer der Gesellschaft wird ${appointee.salutation ? appointee.salutation + " " : ""}${appointee.firstName} ${appointee.lastName}`,
  ]);

  return Object.fromEntries(
    extractionFieldPaths.map((path) => {
      const value = draftValue(input, path);
      if (value === undefined || value === null) return [path, null];
      const quote = evidence
        .get(path)
        ?.map((candidate) => candidate.replace(/\s+/gu, " ").trim())
        .find((candidate) => locateQuote(source, candidate));
      if (!quote)
        throw new Error(
          `Could not anchor ${path}: ${JSON.stringify(evidence.get(path))}`,
        );
      return [path, { value, quote }];
    }),
  );
}

// A fixed reference date keeps the generated corpus byte-for-byte reproducible.
const corpusRuleContext = { referenceDate: "2026-11-23" } as const;

for (const split of splitSchema.options) {
  for (const { id, directory } of await corpusDirectories(split)) {
    try {
      const data = sourceSchema.parse(
        await readJson(new URL("source.json", directory)),
      );
      const model =
        data.kind === "musterprotokoll"
          ? buildMusterprotokoll(data.input, corpusRuleContext)
          : authoredModel(data);
      const bytes = await (data.format === "pdf"
        ? renderPdf(model)
        : renderDocx(model));
      const filename = `document.${data.format}`;
      const source = await ingestDocument(bytes, { filename });
      const fields =
        data.kind === "musterprotokoll"
          ? statutoryLabels(data.input, model, source)
          : Object.fromEntries(
              extractionFieldPaths.map((path) => {
                const entry = data.labels[path];
                return [
                  path,
                  entry
                    ? ({ value: entry[0], quote: entry[1] } satisfies GoldValue)
                    : null,
                ];
              }),
            );
      const gold = goldDocumentSchema.parse({ fields });
      for (const path of extractionFieldPaths) {
        const field = gold.fields[path];
        if (field) anchorGoldEvidence(source, path, field);
      }
      await writeFile(new URL(filename, directory), bytes);
      await writeFile(
        new URL("gold.json", directory),
        JSON.stringify(gold, null, 2) + "\n",
      );
      console.log(`${split}/${id}`);
    } catch (error) {
      throw new Error(`${split}/${id}: ${String(error)}`, { cause: error });
    }
  }
}
