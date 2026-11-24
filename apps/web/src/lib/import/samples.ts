import "server-only";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { z } from "zod";
import { ACCEPTED_TYPES } from "./limits";

const sampleIds = z.enum(["musterprotokoll", "articles"]);

const samples = {
  musterprotokoll: {
    filename: "Musterprotokoll.pdf",
    format: "PDF",
    contentType: ACCEPTED_TYPES[0],
    read: () =>
      readFile(
        join(
          process.cwd(),
          "../../packages/extraction/eval/dev/11-musterprotokoll/document.pdf",
        ),
      ),
  },
  articles: {
    filename: "Satzung.docx",
    format: "DOCX",
    contentType: ACCEPTED_TYPES[1],
    read: () =>
      readFile(
        join(
          process.cwd(),
          "../../packages/extraction/eval/dev/03-zedernrain/document.docx",
        ),
      ),
  },
} satisfies Record<
  z.infer<typeof sampleIds>,
  {
    filename: string;
    format: string;
    contentType: string;
    read: () => Promise<Buffer>;
  }
>;

export const importSamples = sampleIds.options.map((id) => {
  const { filename, format } = samples[id];
  return { id, filename, format };
});

export async function readImportSample(id: unknown): Promise<File | null> {
  const parsed = sampleIds.safeParse(id);
  if (!parsed.success) return null;

  const { filename, contentType, read } = samples[parsed.data];
  return new File([await read()], filename, { type: contentType });
}
