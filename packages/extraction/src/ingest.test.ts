import { createHash } from "node:crypto";
import { buffer } from "node:stream/consumers";
import { strToU8, zipSync } from "fflate";
import PDFDocument from "pdfkit";
import { describe, expect, it } from "vitest";
import { IngestionError } from "./errors";
import { ingestDocument } from "./ingest";
import type { SourceDocument } from "./source";

const word = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
const types = `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;
const xml = (body: string) =>
  `<x:document xmlns:x="${word}"><x:body>${body}</x:body></x:document>`;
const paragraph = (text: string) => `<x:p><x:r><x:t>${text}</x:t></x:r></x:p>`;

function docx(document: string, extra: Record<string, Uint8Array> = {}) {
  return zipSync({
    "[Content_Types].xml": strToU8(types),
    "word/document.xml": strToU8(document),
    ...extra,
  });
}

async function pdf(
  draw: (document: PDFKit.PDFDocument) => void,
  options?: PDFKit.PDFDocumentOptions,
) {
  const document = new PDFDocument(options);
  const contents = buffer(document);
  draw(document);
  document.end();
  return contents;
}

function expectSourceSpans(doc: SourceDocument) {
  expect(doc.segments.map((segment) => segment.text).join("\n")).toBe(doc.text);
  expect(new Set(doc.segments.map((segment) => segment.id)).size).toBe(
    doc.segments.length,
  );
  for (const segment of doc.segments) {
    expect(doc.text.slice(segment.start, segment.end)).toBe(segment.text);
  }
}

describe("ingestDocument", () => {
  it("uses byte signatures, preserves the input bytes and emits positional PDF lines with pages", async () => {
    const bytes = await pdf((document) => {
      document.text("1.", 75, 90, { lineBreak: false });
      document.text("Gründung in Musterau", 101, 90, { lineBreak: false });
      document.text("Muster-UG", 75, 120);
      document.addPage().text("Geschäftsführung", 75, 90);
    });
    const id = createHash("sha256").update(bytes).digest("hex");
    const doc = await ingestDocument(bytes, { filename: "wrong.docx" });
    expect(doc).toMatchObject({ format: "pdf", pageCount: 2, id });
    expect(doc.segments).toMatchObject([
      { kind: "line", page: 1, text: "1. Gründung in Musterau" },
      { kind: "line", page: 1, text: "Muster-UG" },
      { kind: "line", page: 2, text: "Geschäftsführung" },
    ]);
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(id);
    expectSourceSpans(doc);
  });

  it("extracts DOCX body and table paragraphs, joins runs and normalizes text", async () => {
    const bytes = docx(
      xml(
        "<x:p><x:r><x:t> Gru</x:t><x:t>\u0308ndung</x:t><x:tab/><x:t>&amp;   ﬁktive Daten 📄</x:t></x:r></x:p>" +
          `<x:tbl><x:tr><x:tc>${paragraph("Musterau")}</x:tc><x:tc>${paragraph("UG")}</x:tc></x:tr></x:tbl>`,
      ),
      { "word/header1.xml": strToU8(paragraph("Ignored Header")) },
    );
    const doc = await ingestDocument(bytes, { filename: "wrong.pdf" });
    expect(doc.format).toBe("docx");
    expect(doc.pageCount).toBeUndefined();
    expect(doc.text).toBe("Gründung & fiktive Daten 📄\nMusterau\nUG");
    expect(doc.segments.map((segment) => segment.kind)).toEqual([
      "paragraph",
      "paragraph",
      "paragraph",
    ]);
    expectSourceSpans(doc);
  });

  it.each([
    ["UNSUPPORTED_FORMAT", strToU8("fake document")],
    ["UNSUPPORTED_FORMAT", zipSync({ "readme.txt": strToU8("generic ZIP") })],
    ["INVALID_DOCX", strToU8("PK\x03\x04")],
    ["INVALID_DOCX", docx(xml("<x:p>"))],
    [
      "INVALID_DOCX",
      docx(
        `<!DOCTYPE x:document [<!ENTITY bomb "malicious">]>${xml(paragraph("&bomb;"))}`,
      ),
    ],
    ["DOCX_NO_TEXT", docx(xml(paragraph("   ")))],
    ["TEXT_LIMIT", docx(xml(paragraph("x".repeat(2_000_001))))],
  ] as const)("rejects invalid inputs with %s", async (code, bytes) => {
    const response = ingestDocument(bytes, { filename: "sample.pdf" });
    await expect(response).rejects.toBeInstanceOf(IngestionError);
    await expect(response).rejects.toHaveProperty("code", code);
  });

  it("enforces the upload limit and validates overrides", async () => {
    const bytes = new Uint8Array(10 * 1024 * 1024 + 1);
    await expect(
      ingestDocument(bytes, { filename: "file" }),
    ).rejects.toHaveProperty("code", "FILE_TOO_LARGE");
    await expect(
      ingestDocument(bytes.subarray(0, 2), { filename: "file", maxBytes: 1 }),
    ).rejects.toHaveProperty("code", "FILE_TOO_LARGE");
    await expect(
      ingestDocument(bytes, { filename: "file", maxBytes: -1 }),
    ).rejects.toHaveProperty("code", "INVALID_LIMIT");
  });

  it("rejects too many ZIP entries and an oversized declared inflation before reading the body", async () => {
    const extra = Object.fromEntries(
      Array.from({ length: 511 }, (_, index) => [
        `${index}.xml`,
        new Uint8Array(),
      ]),
    );
    const oversized = Buffer.from(
      docx("<broken/>", { "extra.bin": strToU8("compressed") }),
    );
    const directory = oversized.lastIndexOf(
      Buffer.from([0x50, 0x4b, 0x01, 0x02]),
    );
    oversized.writeUInt32LE(25 * 1024 * 1024, directory + 24);
    for (const bytes of [docx(xml(paragraph("hello")), extra), oversized]) {
      await expect(
        ingestDocument(bytes, { filename: "file.docx" }),
      ).rejects.toHaveProperty("code", "DOCX_ARCHIVE_LIMIT");
    }
  });

  it("enforces actual inflated sizes when a ZIP central directory understates them", async () => {
    const bytes = Buffer.from(docx(xml(paragraph("compressible".repeat(200)))));
    const directory = bytes.lastIndexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
    bytes.writeUInt32LE(32, directory + 24);
    await expect(
      ingestDocument(bytes, { filename: "file.docx" }),
    ).rejects.toHaveProperty("code", "INVALID_DOCX");
  });

  it("rejects corrupt, encrypted, textless or overlong PDFs", async () => {
    const text = (document: PDFKit.PDFDocument) => document.text("Gründung");
    const cases = [
      ["INVALID_PDF", strToU8("%PDF-1.7\ntruncated")],
      [
        "PDF_ENCRYPTED",
        await pdf(text, { userPassword: "fictional-password" }),
      ],
      ["PDF_ENCRYPTED", await pdf(text, { ownerPassword: "fictional-owner" })],
      [
        "PDF_NO_TEXT",
        await pdf((document) => document.rect(100, 100, 80, 40).fill()),
      ],
      [
        "PDF_PAGE_LIMIT",
        await pdf((document) => {
          for (let index = 1; index <= 30; index++) document.addPage();
        }),
      ],
    ] as const;
    for (const [code, bytes] of cases) {
      await expect(
        ingestDocument(bytes, { filename: "file.pdf" }),
      ).rejects.toHaveProperty("code", code);
    }
  });
});
