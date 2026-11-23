import { getMeta } from "unpdf";
import { getDocument, PasswordException } from "unpdf/pdfjs";
import type { SourceSegment } from "./source";
import { IngestionError, MAX_TEXT_UNITS } from "./errors";

type PdfPage = Awaited<
  ReturnType<Awaited<ReturnType<typeof getDocument>["promise"]>["getPage"]>
>;
type TextChunk = Awaited<ReturnType<PdfPage["getTextContent"]>>;
type TextItem = Extract<TextChunk["items"][number], { str: string }>;
type Line = Pick<SourceSegment, "kind" | "page" | "text">;

const MAX_PAGES = 30;

function position(item: TextItem) {
  const [a = 1, b = 0, , , x = 0, y = 0] = item.transform;
  const scale = Math.hypot(a, b) || 1;
  const cos = a / scale;
  const sin = b / scale;
  return {
    cos,
    sin,
    along: x * cos + y * sin,
    baseline: y * cos - x * sin,
    tolerance: Math.max(2, item.height * 0.45),
  };
}

export async function readPdf(bytes: Uint8Array) {
  const task = getDocument({
    data: Uint8Array.from(bytes),
    stopAtErrors: true,
    disableFontFace: true,
    useSystemFonts: false,
    useWasm: false,
    enableXfa: false,
  });
  try {
    const pdf = await task.promise;
    if (pdf.numPages > MAX_PAGES) throw new IngestionError("PDF_PAGE_LIMIT");
    const { info } = await getMeta(pdf);
    if (info.EncryptFilterName) throw new IngestionError("PDF_ENCRYPTED");

    const lines: Line[] = [];
    let textUnits = 0;
    for (let page = 1; page <= pdf.numPages; page++) {
      const pdfPage = await pdf.getPage(page);
      const reader = pdfPage
        .streamTextContent({ disableNormalization: true })
        .getReader() as ReadableStreamDefaultReader<TextChunk>;
      const pageLines: string[] = [];
      let pieces: string[] = [];
      let previous: TextItem | undefined;
      try {
        for (;;) {
          const chunk = await reader.read();
          if (chunk.done) break;
          for (const item of chunk.value.items) {
            if (!("str" in item) || item.str.length === 0) continue;
            textUnits += item.str.length + 1;
            if (textUnits > MAX_TEXT_UNITS)
              throw new IngestionError("TEXT_LIMIT");
            if (previous) {
              const from = position(previous);
              const to = position(item);
              const rotated =
                Math.abs(from.cos - to.cos) + Math.abs(from.sin - to.sin) > 0.1;
              if (
                rotated ||
                Math.abs(to.baseline - from.baseline) >
                  Math.max(from.tolerance, to.tolerance)
              ) {
                pageLines.push(pieces.join(""));
                pieces = [];
              } else if (to.along - from.along - previous.width > 1) {
                pieces.push(" ");
              }
            }
            pieces.push(item.str);
            previous = item;
          }
        }
      } finally {
        reader.releaseLock();
      }
      pageLines.push(pieces.join(""));
      let continuation = "";
      for (const raw of pageLines) {
        const text = continuation + raw.trim();
        if (text.endsWith("\u00ad")) {
          continuation = text.slice(0, -1);
        } else {
          if (text) lines.push({ kind: "line", page, text });
          continuation = "";
        }
      }
      if (continuation) lines.push({ kind: "line", page, text: continuation });
      pdfPage.cleanup();
    }
    return { segments: lines, pageCount: pdf.numPages };
  } catch (error) {
    if (error instanceof IngestionError) throw error;
    if (error instanceof PasswordException)
      throw new IngestionError("PDF_ENCRYPTED");
    throw new IngestionError("INVALID_PDF");
  } finally {
    await task.destroy();
  }
}
