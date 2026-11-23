import { createHash } from "node:crypto";
import { readDocx } from "./docx";
import { IngestionError } from "./errors";
import { readPdf } from "./pdf";
import {
  normalizeText,
  type SourceDocument,
  type SourceSegment,
} from "./source";

export interface IngestOptions {
  filename: string;
  maxBytes?: number;
}

const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46, 0x2d]; // %PDF-
const ZIP_SIGNATURE = [0x50, 0x4b, 0x03, 0x04]; // ZIP local file header

export async function ingestDocument(
  bytes: Uint8Array,
  { maxBytes = DEFAULT_MAX_BYTES }: IngestOptions,
): Promise<SourceDocument> {
  if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0)
    throw new IngestionError("INVALID_LIMIT");
  if (bytes.byteLength > maxBytes) throw new IngestionError("FILE_TOO_LARGE");
  const format = PDF_SIGNATURE.every((byte, i) => bytes[i] === byte)
    ? "pdf"
    : ZIP_SIGNATURE.every((byte, i) => bytes[i] === byte)
      ? "docx"
      : undefined;
  if (!format) throw new IngestionError("UNSUPPORTED_FORMAT");

  const id = createHash("sha256").update(bytes).digest("hex");
  const input = format === "pdf" ? await readPdf(bytes) : await readDocx(bytes);
  const segments: SourceSegment[] = [];
  let start = 0;
  for (const segment of input.segments) {
    const text = normalizeText(segment.text);
    if (!text) continue;
    const end = start + text.length;
    segments.push({
      ...segment,
      id: `s${segments.length + 1}`,
      text,
      start,
      end,
    });
    start = end + 1;
  }
  if (!segments.length) {
    throw new IngestionError(format === "pdf" ? "PDF_NO_TEXT" : "DOCX_NO_TEXT");
  }
  return {
    id,
    format,
    ...("pageCount" in input ? { pageCount: input.pageCount } : {}),
    text: segments.map((segment) => segment.text).join("\n"),
    segments,
  };
}
