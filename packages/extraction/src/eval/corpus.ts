import { readFile, readdir } from "node:fs/promises";
import { z } from "zod";
import { ingestDocument } from "../ingest";
import { goldDocumentSchema } from "./gold";

/**
 * `dev` is for developing predictors and prompts, `test` is fixed for
 * reporting, and `adversarial` holds documents that try to manipulate an
 * extractor, such as prompt injections. It is reported separately.
 */
export const splitSchema = z.enum(["dev", "test", "adversarial"]);
export type CorpusSplit = z.infer<typeof splitSchema>;
export const corpusRoot = new URL("../../eval/", import.meta.url);
export const formatSchema = z.enum(["pdf", "docx"]);

export async function corpusDirectories(split: CorpusSplit) {
  const splitRoot = new URL(`${split}/`, corpusRoot);
  const entries = await readdir(splitRoot, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .map((id) => ({
      id,
      directory: new URL(`${id}/`, splitRoot),
    }));
}

export async function readJson(path: URL): Promise<unknown> {
  return JSON.parse(await readFile(path, "utf8"));
}

export async function loadCorpus(split: CorpusSplit) {
  return Promise.all(
    (await corpusDirectories(split)).map(async ({ id, directory }) => {
      const metadata = z
        .object({ format: formatSchema })
        .parse(await readJson(new URL("source.json", directory)));
      const filename = `document.${metadata.format}`;
      const bytes = await readFile(new URL(filename, directory));
      const source = await ingestDocument(bytes, { filename });
      if (source.format !== metadata.format)
        throw new Error(`${id}: generated file format mismatch`);
      const gold = goldDocumentSchema.parse(
        await readJson(new URL("gold.json", directory)),
      );
      return { id, source, gold };
    }),
  );
}
