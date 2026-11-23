"use client";

import type {
  Citation,
  ExtractionFieldPath,
  FieldStatus,
  SourceDocument,
  SourceSegment,
} from "@urkundenwerk/extraction/contract";
import { type KeyboardEvent, type ReactNode, useMemo } from "react";
import { fieldLabel } from "../../../../lib/builder/fields";

export type SourceCitation = {
  path: ExtractionFieldPath;
  citation: Citation;
  status: FieldStatus;
};

type Piece = { start: number; end: number; covering: SourceCitation[] };

/**
 * Splits a segment at every citation boundary, so overlapping quotes (a
 * salutation, first name, and last name often share one passage) become
 * pieces that know every citation covering them.
 */
export function pieces(
  segment: Pick<SourceSegment, "start" | "end">,
  citations: readonly SourceCitation[],
): Piece[] {
  const inside = citations.filter(
    ({ citation }) =>
      citation.start < segment.end && segment.start < citation.end,
  );
  const cuts = new Set([segment.start, segment.end]);
  for (const { citation } of inside) {
    cuts.add(Math.max(segment.start, citation.start));
    cuts.add(Math.min(segment.end, citation.end));
  }
  const points = [...cuts].sort((a, b) => a - b);
  return points.slice(0, -1).map((start, index) => {
    const end = points[index + 1]!;
    return {
      start,
      end,
      covering: inside.filter(
        ({ citation }) => citation.start < end && start < citation.end,
      ),
    };
  });
}

/** The citation a click on a piece means: the active one, else the narrowest. */
function primary(covering: readonly SourceCitation[], activePath?: string) {
  return (
    covering.find(({ path }) => path === activePath) ??
    [...covering].sort(
      (a, b) =>
        a.citation.end - a.citation.start - (b.citation.end - b.citation.start),
    )[0]!
  );
}

export function SourceSheet({
  source,
  citations,
  activePath,
  suspiciousSegments,
  onSelect,
}: {
  source: SourceDocument;
  citations: readonly SourceCitation[];
  activePath?: ExtractionFieldPath;
  suspiciousSegments: readonly string[];
  onSelect: (path: ExtractionFieldPath) => void;
}) {
  const suspicious = useMemo(
    () => new Set(suspiciousSegments),
    [suspiciousSegments],
  );

  const renderSegment = (segment: SourceSegment): ReactNode =>
    pieces(segment, citations).map(({ start, end, covering }) => {
      const text = source.text.slice(start, end);
      if (covering.length === 0) return <span key={start}>{text}</span>;
      const target = primary(covering, activePath);
      const active = covering.some(({ path }) => path === activePath);
      const unverified = covering.every(({ status }) => status !== "verified");
      const shared = {
        "data-source-paths": covering.map(({ path }) => path).join(" "),
        "data-active": active || undefined,
        "data-unverified": unverified || undefined,
        className: "source-mark",
        onClick: () => onSelect(target.path),
      };
      // Each citation is one button, at the piece where it starts, named
      // with its whole quote. Later pieces (a quote can run over several
      // lines) are marked for the eye and the mouse only.
      const starting = covering.filter(
        ({ citation }) => citation.start === start,
      );
      if (starting.length === 0) {
        return (
          <mark key={start} {...shared}>
            {text}
          </mark>
        );
      }
      const own = primary(starting, activePath);
      const labels = starting.map(({ path }) => fieldLabel(path)).join(", ");
      return (
        <mark
          key={start}
          {...shared}
          role="button"
          tabIndex={0}
          aria-label={`Passage for ${labels}: ${own.citation.quote}`}
          onKeyDown={(event: KeyboardEvent<HTMLElement>) => {
            if (event.key === "Enter" || event.key === " ") {
              event.preventDefault();
              onSelect(own.path);
            }
          }}
        >
          {text}
        </mark>
      );
    });

  // PDF lines are grouped by page; DOCX paragraphs have no pages.
  const pages = new Map<number, SourceSegment[]>();
  for (const segment of source.segments) {
    const page = source.format === "pdf" ? (segment.page ?? 1) : 0;
    pages.set(page, [...(pages.get(page) ?? []), segment]);
  }

  return (
    <article
      aria-label="Document text"
      className="deed-sheet mx-auto max-w-[52rem]"
    >
      <div className="source-text">
        {[...pages].map(([page, segments]) => (
          <div key={page} className="source-page">
            {source.format === "pdf" ? (
              <p className="source-page-number">Page {page}</p>
            ) : null}
            {segments.map((segment) => (
              <p
                key={segment.id}
                id={`source-${segment.id}`}
                data-kind={segment.kind}
                data-suspicious={suspicious.has(segment.id) || undefined}
                className="source-segment"
              >
                {suspicious.has(segment.id) ? (
                  <span className="source-warning">
                    Reads like an instruction to an AI
                  </span>
                ) : null}
                {renderSegment(segment)}
              </p>
            ))}
          </div>
        ))}
      </div>
    </article>
  );
}
