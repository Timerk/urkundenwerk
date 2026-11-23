import { readFile } from "node:fs/promises";
import { buildMusterprotokoll } from "@urkundenwerk/core";
import { XMLParser } from "fast-xml-parser";
import JSZip from "jszip";
import { extractText, getDocumentProxy } from "unpdf";
import { afterEach, expect, it, vi } from "vitest";
import {
  exampleCase,
  exampleContext,
} from "../../core/src/templates/musterprotokoll-einpersonen/fixtures";
import { renderDocx, renderPdf } from "./index";

const model = buildMusterprotokoll(
  {
    ...exampleCase,
    notarisation: { mode: "in_person" },
    notaryNotes: undefined,
  },
  exampleContext,
);
const goldenUrl = new URL(
  "../../core/src/templates/musterprotokoll-einpersonen/goldens/notary-blanks.txt",
  import.meta.url,
);

const parser = new XMLParser({
  parseTagValue: false,
  trimValues: false,
  isArray: (_name, path) =>
    path === "w:document.w:body.w:p" || path === "w:document.w:body.w:p.w:r",
});

type WordRun = { "w:br"?: string; "w:t"?: string; "w:tab"?: string };

function readDocumentText(xml: string): string {
  const document: {
    "w:document": { "w:body": { "w:p": { "w:r"?: WordRun[] }[] } };
  } = parser.parse(xml);
  return document["w:document"]["w:body"]["w:p"]
    .flatMap((paragraph) => (paragraph["w:r"] ? [paragraph["w:r"]] : []))
    .map((runs) =>
      runs
        .map(
          (run) =>
            (run["w:br"] === undefined ? "" : "\n") +
            (run["w:t"] ?? "") +
            (run["w:tab"] === undefined ? "" : " "),
        )
        .join(""),
    )
    .join("\n\n");
}

async function goldenText(): Promise<string> {
  // Exporters draw rules, while the plain-text renderer uses underscores.
  const golden = await readFile(goldenUrl, "utf8");
  return golden.replace(/^_{30}\n/gm, "");
}

const closing = "Vorgelesen, genehmigt und eigenhändig unterschrieben:";
const signatureText = [closing, "Erika Mustermann", "Notar/in"];

afterEach(() => {
  vi.useRealTimers();
});

it("renders deterministic DOCX bytes with the golden text, embedded font, and page numbering", async () => {
  vi.setSystemTime(new Date("2025-01-01T12:00:00Z"));
  const first = await renderDocx(model);
  vi.setSystemTime(new Date("2026-12-31T18:00:00Z"));
  const second = await renderDocx(model);
  expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);

  const zip = await JSZip.loadAsync(first);
  const xml = await zip.file("word/document.xml")!.async("string");
  const golden = await goldenText();
  expect(readDocumentText(xml)).toBe(golden.trimEnd());
  const signatureParagraphs = xml.match(/<w:p>[\s\S]*?<\/w:p>/g)!.slice(-5);
  expect(signatureParagraphs[0]).toContain(closing);
  expect(signatureParagraphs[1]).toContain("<w:bottom ");
  expect(signatureParagraphs[3]).toContain("<w:bottom ");
  expect(signatureParagraphs.every((p) => p.includes("<w:keepLines/>"))).toBe(
    true,
  );
  expect(
    signatureParagraphs.slice(0, -1).every((p) => p.includes("<w:keepNext/>")),
  ).toBe(true);
  expect(xml.match(/<w:pgSz[^>]+>/)?.[0]).toContain('w:w="11905" w:h="16837"');
  expect(xml).toContain('w:hanging="420"');
  const footer = await zip.file("word/footer1.xml")!.async("string");
  expect(footer).toMatch(/>PAGE</);

  const fontXml = await zip.file("word/fontTable.xml")!.async("string");
  const key = Buffer.from(
    fontXml.match(/w:fontKey="\{([\dA-F-]+)\}"/)![1]!.replaceAll("-", ""),
    "hex",
  ).reverse();
  const font = await zip.file("word/fonts/font1.odttf")!.async("nodebuffer");
  for (let i = 0; i < 32; i++) font[i] = font[i]! ^ key[i % key.length]!;
  expect(
    font.equals(
      await readFile(
        new URL("../assets/SourceSerif4-Regular.ttf", import.meta.url),
      ),
    ),
  ).toBe(true);
});

const whitespace = (text: string) => text.trim().replace(/\s+/g, " ");

it("renders a deterministic, text-searchable single-page A4 PDF", async () => {
  vi.setSystemTime(new Date("2025-01-01T12:00:00Z"));
  const first = await renderPdf(model);
  vi.setSystemTime(new Date("2026-12-31T18:00:00Z"));
  const second = await renderPdf(model);
  expect(Buffer.from(first).equals(Buffer.from(second))).toBe(true);

  const pdf = await getDocumentProxy(first);
  try {
    const page = await pdf.getPage(1);
    expect(page.view[2]).toBeCloseTo(595.28);
    expect(page.view[3]).toBeCloseTo(841.89);
    const { totalPages, text } = await extractText(pdf, { mergePages: true });
    expect(totalPages).toBe(1);
    expect(text).toContain(closing);
    const golden = await goldenText();
    expect(whitespace(text)).toBe(`${whitespace(golden)} 1`);
  } finally {
    await pdf.loadingTask.destroy();
  }
});

it("continues a long clause across pages and keeps the closing and signatures together", async () => {
  const notaryNotes = Array.from(
    { length: 44 },
    (_, index) => `Fiktiver Hinweis ${index + 1} zur Beurkundung.`,
  ).join("\n");
  const pdf = await getDocumentProxy(
    await renderPdf(
      buildMusterprotokoll(
        {
          ...exampleCase,
          notaryNotes,
        },
        exampleContext,
      ),
    ),
  );
  try {
    const { totalPages, text } = await extractText(pdf);
    expect(totalPages).toBe(3);
    expect(text[0]).toContain("Fiktiver Hinweis 1 zur Beurkundung.");
    // Clause 7 ends on page 2, but there is too little room for the whole block.
    expect(text[1]).toContain("Fiktiver Hinweis 44 zur Beurkundung.");
    expect(text[1]).not.toContain(closing);
    expect(whitespace(text[2]!)).toBe(`${signatureText.join(" ")} 3`);
    for (const [index, pageText] of text.entries()) {
      expect(whitespace(pageText)).toMatch(new RegExp(` ${index + 1}$`));
    }
  } finally {
    await pdf.loadingTask.destroy();
  }
});
