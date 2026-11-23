export interface SourceSegment {
  readonly id: string;
  readonly kind: "paragraph" | "line";
  readonly page?: number;
  readonly start: number;
  readonly end: number;
  readonly text: string;
}

export interface SourceDocument {
  readonly id: string;
  readonly format: "pdf" | "docx";
  readonly pageCount?: number;
  readonly text: string;
  readonly segments: readonly SourceSegment[];
}

const ligatures = {
  ﬀ: "ff",
  ﬁ: "fi",
  ﬂ: "fl",
  ﬃ: "ffi",
  ﬄ: "ffl",
  ﬅ: "st",
  ﬆ: "st",
} as const;

export function normalizeText(text: string): string {
  return text
    .replace(/[ﬀ-ﬆ]/gu, (letter) => ligatures[letter as keyof typeof ligatures])
    .replace(/\u00ad/gu, "")
    .normalize("NFC")
    .replace(/\s+/gu, " ")
    .trim();
}
