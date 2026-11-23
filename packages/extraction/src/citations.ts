import { z } from "zod";
import { normalizeText, type SourceDocument } from "./source";

export const citationSchema = z
  .strictObject({
    segmentId: z.string().min(1),
    start: z.int().nonnegative(),
    end: z.int().positive(),
    quote: z.string().min(1),
  })
  .refine(({ start, end }) => end > start, { path: ["end"] });

export type Citation = z.infer<typeof citationSchema>;

export function verifyCitation(
  doc: SourceDocument,
  citation: Citation,
): boolean {
  const result = citationSchema.safeParse(citation);
  if (!result.success) return false;
  const { segmentId, start, end, quote } = result.data;
  return (
    end <= doc.text.length &&
    doc.text.slice(start, end) === quote &&
    doc.segments.some(
      (segment) =>
        segment.id === segmentId &&
        segment.start <= start &&
        start < segment.end,
    )
  );
}

function makeCitation(
  doc: SourceDocument,
  start: number,
  end: number,
): Citation | null {
  const segment = doc.segments.find(
    (segment) => segment.start <= start && start < segment.end,
  );
  if (!segment) return null;
  return {
    segmentId: segment.id,
    start,
    end,
    quote: doc.text.slice(start, end),
  };
}

function fold(token: string): string {
  return token.toLowerCase().replaceAll("ς", "σ");
}

/** Prefers a unique verbatim match, then a unique whitespace/case-folded match. */
export function locateQuote(
  doc: SourceDocument,
  quote: string,
): Citation | null {
  const verbatim = quote.trim();
  if (!verbatim) return null;
  const exactStart = doc.text.indexOf(verbatim);
  if (exactStart >= 0) {
    if (doc.text.indexOf(verbatim, exactStart + 1) >= 0) return null;
    return makeCitation(doc, exactStart, exactStart + verbatim.length);
  }

  const needle = [...normalizeText(verbatim)].map(fold).join("");
  if (!needle) return null;
  // Only token boundaries get source offsets. A match cannot cut a surrogate
  // pair, a case-fold expansion, or a collapsed whitespace run in half.
  const offsets: number[] = [];
  let foldedLength = 0;
  const haystack = doc.text.replace(
    /\s+|\S/gu,
    (token: string, offset: number) => {
      const normalized = /\s/u.test(token) ? " " : fold(token);
      offsets[foldedLength] = offset;
      foldedLength += normalized.length;
      return normalized;
    },
  );
  offsets[foldedLength] = doc.text.length;

  let match: Citation | null = null;
  for (
    let index = haystack.indexOf(needle);
    index >= 0;
    index = haystack.indexOf(needle, index + 1)
  ) {
    const start = offsets[index];
    const end = offsets[index + needle.length];
    if (start === undefined || end === undefined) continue;
    const candidate = makeCitation(doc, start, end);
    if (!candidate) continue;
    if (match) return null;
    match = candidate;
  }
  return match;
}
