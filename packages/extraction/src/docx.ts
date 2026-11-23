import { SaxesParser } from "saxes";
import { fromBufferPromise, type Entry, type ZipFile } from "yauzl";
import { IngestionError, MAX_TEXT_UNITS } from "./errors";

const MAX_ENTRIES = 512;
const MAX_INFLATED_BYTES = 25 * 1024 * 1024;
const WORD_NAMESPACES = new Set([
  "http://schemas.openxmlformats.org/wordprocessingml/2006/main",
  "http://purl.oclc.org/ooxml/wordprocessingml/main",
]);
const TYPES_NS = "http://schemas.openxmlformats.org/package/2006/content-types";
const DOCUMENT_PATH = "word/document.xml";
const WORD_DOCUMENT_TYPE =
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml";

async function readPart(zip: ZipFile, entry: Entry) {
  const stream = await zip.openReadStreamPromise(entry);
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream) chunks.push(chunk);
  const bytes = Buffer.concat(chunks);
  const encoding =
    bytes[0] === 0xff && bytes[1] === 0xfe
      ? "utf-16le"
      : bytes[0] === 0xfe && bytes[1] === 0xff
        ? "utf-16be"
        : "utf-8";
  return new TextDecoder(encoding, { fatal: true }).decode(bytes);
}

function xmlParser() {
  const parser = new SaxesParser({ xmlns: true });
  parser.on("doctype", () => {
    throw new IngestionError("INVALID_DOCX");
  });
  return parser;
}

function isWordDocument(xml: string) {
  const parser = xmlParser();
  let recognized = false;
  parser.on("opentag", (tag) => {
    if (
      tag.uri === TYPES_NS &&
      tag.local === "Override" &&
      tag.attributes.PartName?.value === "/" + DOCUMENT_PATH &&
      tag.attributes.ContentType?.value === WORD_DOCUMENT_TYPE
    )
      recognized = true;
  });
  parser.write(xml).close();
  return recognized;
}

function extractParagraphs(xml: string) {
  const parser = xmlParser();
  const paragraphs: string[][] = [];
  const active: string[][] = [];
  let depth = 0;
  let bodyDepth = 0;
  let textDepth = 0;
  let wordRoot = false;
  let textUnits = 0;
  const append = (text: string) => {
    const paragraph = active.at(-1);
    if (!paragraph) return;
    textUnits += text.length;
    if (textUnits > MAX_TEXT_UNITS) throw new IngestionError("TEXT_LIMIT");
    paragraph.push(text);
  };
  parser.on("opentag", (tag) => {
    depth++;
    if (!WORD_NAMESPACES.has(tag.uri)) return;
    if (depth === 1) wordRoot = tag.local === "document";
    if (depth === 2 && wordRoot && tag.local === "body") bodyDepth = depth;
    if (!bodyDepth) return;
    switch (tag.local) {
      case "p": {
        const paragraph: string[] = [];
        paragraphs.push(paragraph);
        active.push(paragraph);
        if (paragraphs.length > MAX_TEXT_UNITS)
          throw new IngestionError("TEXT_LIMIT");
        break;
      }
      case "t":
        textDepth = depth;
        break;
      case "br":
      case "cr":
      case "tab":
        append(" ");
        break;
      case "noBreakHyphen":
        append("‑");
        break;
    }
  });
  parser.on("text", (text) => {
    if (textDepth === depth) append(text);
  });
  parser.on("closetag", (tag) => {
    if (bodyDepth && WORD_NAMESPACES.has(tag.uri) && tag.local === "p")
      active.pop();
    if (depth === textDepth) textDepth = 0;
    if (depth === bodyDepth) bodyDepth = 0;
    depth--;
  });
  parser.write(xml).close();
  if (!wordRoot) throw new IngestionError("INVALID_DOCX");
  return {
    segments: paragraphs.map((pieces) => ({
      kind: "paragraph" as const,
      text: pieces.join(""),
    })),
  };
}

export async function readDocx(bytes: Uint8Array) {
  let zip: ZipFile | undefined;
  try {
    const archive = await fromBufferPromise(
      Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength),
      {
        lazyEntries: true,
        autoClose: false,
        validateEntrySizes: true,
      },
    );
    zip = archive;
    if (archive.entryCount > MAX_ENTRIES)
      throw new IngestionError("DOCX_ARCHIVE_LIMIT");
    let totalSize = 0;
    const entries = new Map<string, Entry>();
    for await (const entry of archive.eachEntry()) {
      totalSize += entry.uncompressedSize;
      if (totalSize > MAX_INFLATED_BYTES)
        throw new IngestionError("DOCX_ARCHIVE_LIMIT");
      if (entries.has(entry.fileName) || entry.isEncrypted())
        throw new IngestionError("INVALID_DOCX");
      entries.set(entry.fileName, entry);
    }
    const types = entries.get("[Content_Types].xml");
    const document = entries.get(DOCUMENT_PATH);
    if (
      !types ||
      !document ||
      !isWordDocument(await readPart(archive, types))
    ) {
      throw new IngestionError("UNSUPPORTED_FORMAT");
    }
    return extractParagraphs(await readPart(archive, document));
  } catch (error) {
    if (error instanceof IngestionError) throw error;
    throw new IngestionError("INVALID_DOCX");
  } finally {
    zip?.close();
  }
}
