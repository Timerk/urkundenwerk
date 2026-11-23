import { describe, expect, it } from "vitest";
import { locateQuote, verifyCitation, type SourceDocument } from "./index";

function source(...lines: string[]): SourceDocument {
  let start = 0;
  const segments = lines.map((text, index) => {
    const segment = {
      id: `s${index + 1}`,
      kind: "line" as const,
      text,
      start,
      end: start + text.length,
    };
    start = segment.end + 1;
    return segment;
  });
  return { id: "source", format: "pdf", text: lines.join("\n"), segments };
}

describe("source citations", () => {
  it("matches decomposed umlauts, mixed case and line breaks and returns verbatim UTF-16 offsets", () => {
    const doc = source("📄 Die Gründerin.", "MÜLLER gründet", "die Firma.");
    const citation = locateQuote(doc, "Mu\u0308ller  gru\u0308ndet\tDIE");
    expect(citation).toEqual({
      segmentId: "s2",
      start: doc.text.indexOf("MÜLLER"),
      end: doc.text.indexOf(" Firma."),
      quote: "MÜLLER gründet\ndie",
    });
    if (!citation) throw new Error("Expected citation");
    expect(verifyCitation(doc, citation)).toBe(true);
    expect(verifyCitation(doc, { ...citation, segmentId: "s1" })).toBe(false);
    expect(
      verifyCitation(doc, { ...citation, quote: "Müller gründet die" }),
    ).toBe(false);
    expect(verifyCitation(doc, { ...citation, end: citation.end + 200 })).toBe(
      false,
    );
  });

  it("rejects duplicates, overlapping duplicate text, whitespace, and missing quotes", () => {
    expect(
      locateQuote(source("Muster GmbH", "Muster GmbH"), "Muster GmbH"),
    ).toBeNull();
    expect(
      locateQuote(source("MUSTER GMBH", "muster gmbh"), "Muster GmbH"),
    ).toBeNull();
    expect(locateQuote(source("aaaaa"), "aaa")).toBeNull();
    expect(locateQuote(source("Muster"), "  ")).toBeNull();
    expect(locateQuote(source("Muster"), "Anderes")).toBeNull();
  });

  it("prefers a unique verbatim match over a folded one and preserves Unicode case expansions", () => {
    expect(
      locateQuote(source("Muster GmbH", "MUSTER GMBH"), "Muster GmbH")
        ?.segmentId,
    ).toBe("s1");
    expect(locateQuote(source("İstanbul"), "i\u0307STANBUL")?.quote).toBe(
      "İstanbul",
    );
    expect(locateQuote(source("İstanbul"), "i")).toBeNull();
  });
});
