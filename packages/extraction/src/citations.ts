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

export interface LocateOptions {
  /**
   * Accept only matches that start in this segment. A passage that repeats
   * elsewhere in the document can still be anchored when the extractor names
   * the segment it read it from.
   */
  segmentId?: string;
}

/**
 * Every match of a quote, verbatim matches first. Only if there is none are
 * whitespace- and case-folded matches returned.
 */
function quoteMatches(doc: SourceDocument, quote: string): Citation[] {
  const verbatim = quote.trim();
  if (!verbatim) return [];
  const exact: Citation[] = [];
  for (
    let start = doc.text.indexOf(verbatim);
    start >= 0;
    start = doc.text.indexOf(verbatim, start + 1)
  ) {
    const candidate = makeCitation(doc, start, start + verbatim.length);
    if (candidate) exact.push(candidate);
  }
  if (exact.length) return exact;

  const needle = [...normalizeText(verbatim)].map(fold).join("");
  if (!needle) return [];
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

  const folded: Citation[] = [];
  for (
    let index = haystack.indexOf(needle);
    index >= 0;
    index = haystack.indexOf(needle, index + 1)
  ) {
    const start = offsets[index];
    const end = offsets[index + needle.length];
    if (start === undefined || end === undefined) continue;
    const candidate = makeCitation(doc, start, end);
    if (candidate) folded.push(candidate);
  }
  return folded;
}

/** How often a quote occurs, by the same matching rules as `locateQuote`. */
export function countQuoteMatches(doc: SourceDocument, quote: string): number {
  return quoteMatches(doc, quote).length;
}

/**
 * Prefers a unique verbatim match, then a unique whitespace/case-folded match.
 * With `segmentId`, only matches starting in that segment count.
 */
export function locateQuote(
  doc: SourceDocument,
  quote: string,
  { segmentId }: LocateOptions = {},
): Citation | null {
  const matches = quoteMatches(doc, quote).filter(
    (match) => segmentId === undefined || match.segmentId === segmentId,
  );
  return matches.length === 1 ? matches[0]! : null;
}
