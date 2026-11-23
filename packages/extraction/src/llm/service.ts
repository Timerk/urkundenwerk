import {
  isLlmError,
  type LlmClient,
  type LlmErrorKind,
  type LlmUsage,
} from "@urkundenwerk/ai";
import { countQuoteMatches, locateQuote, verifyCitation } from "../citations";
import { fieldKind } from "../fields";
import type { Citation } from "../citations";
import {
  extractionFieldPaths,
  extractionResultSchema,
  type ExtractedField,
  type ExtractionFieldPath,
  type ExtractionFieldValue,
  type ExtractionResult,
} from "../result";
import type { SourceDocument } from "../source";
import {
  looksLikeInstruction,
  normaliseValue,
  quoteSupportsValue,
} from "./grounding";
import {
  EXTRACTION_PROMPT_VERSION,
  EXTRACTION_SYSTEM_PROMPT,
  extractionOutputSchema,
  extractionUserMessage,
  type ExtractionOutput,
} from "./prompt";

/** The longest normalized text sent for extraction, about 20,000 tokens. */
export const MAX_EXTRACTION_CHARACTERS = 60_000;
/** Room for adaptive thinking and 30 quoted fields, within a non-streaming call. */
const MAX_OUTPUT_TOKENS = 16_000;

export type FieldStatus = "verified" | "unverified" | "absent";

export type UnverifiedReason =
  | "value_unreadable"
  | "quote_not_found"
  | "quote_ambiguous"
  | "value_not_in_quote"
  | "suspicious_passage"
  | "duplicate_field";

const VALUE_NAMES = {
  text: "text",
  freeText: "text",
  date: "a date",
  amount: "a euro amount",
  enum: "one of the field's options",
} as const;

function reasonMessage(
  reason: UnverifiedReason,
  path: ExtractionFieldPath,
): string {
  switch (reason) {
    case "value_unreadable":
      return `The value could not be read as ${VALUE_NAMES[fieldKind(path).type]}.`;
    case "quote_not_found":
      return "The quoted passage was not found in the document.";
    case "quote_ambiguous":
      return "The quoted passage occurs more than once, so its source is unclear.";
    case "value_not_in_quote":
      return "The value does not appear in the quoted passage.";
    case "suspicious_passage":
      return "The passage reads like an instruction to an AI, not like contract text.";
    case "duplicate_field":
      return "The model returned this field more than once; the first answer is shown.";
  }
}

export interface FieldReview {
  path: ExtractionFieldPath;
  status: FieldStatus;
  /** The value in the draft's type, or `null` if absent or unreadable. */
  value: Exclude<ExtractionFieldValue, null> | null;
  /** The value as the model wrote it. */
  text: string | null;
  /** The passage as the model quoted it. */
  quote: string | null;
  /** The quote anchored in the source by our code, if it could be. */
  citation: Citation | null;
  /** Why the value is not verified. Empty for verified and absent fields. */
  reasons: { code: UnverifiedReason; message: string }[];
  /** The model's note on this field, if any. */
  note: string | null;
}

export interface ExtractionReview {
  /** Every field path in form order, with its status. */
  fields: FieldReview[];
  /** The contract the evaluation scores: normalised values and citations. */
  result: ExtractionResult;
  /** Segments that read like instructions to an AI. */
  suspiciousSegments: string[];
  model: string;
  promptVersion: string;
  usage: LlmUsage;
  latencyMs: number;
}

export type ExtractionErrorCode = "DOCUMENT_TOO_LONG" | LlmErrorKind;

const ERROR_MESSAGES: Record<ExtractionErrorCode, string> = {
  DOCUMENT_TOO_LONG:
    "The document is too long for AI extraction. Upload the formation deed or the articles on their own.",
  timeout: "The AI took too long to answer. Try again in a moment.",
  rate_limited: "The AI service is busy. Try again in a minute.",
  unavailable: "The AI service is unavailable. Try again later.",
  unauthorized: "The AI service is not set up correctly on this server.",
  rejected: "The AI service rejected the request.",
  refused: "The AI declined to extract data from this document.",
  truncated: "The AI's answer was cut off. Try a shorter document.",
  invalid_output: "The AI's answer did not have the expected form. Try again.",
  aborted: "The extraction was cancelled.",
};

/** A failed extraction. `message` is fit to show; it never contains document text. */
export class ExtractionError extends Error {
  constructor(
    readonly code: ExtractionErrorCode,
    options?: ErrorOptions,
  ) {
    super(ERROR_MESSAGES[code], options);
    this.name = "ExtractionError";
  }
}

export interface ExtractOptions {
  client: LlmClient;
  model: string;
  /** Thinking effort; the default suits a few pages of text. */
  effort?: "low" | "medium" | "high";
  signal?: AbortSignal;
  /** Injected for tests. */
  now?: () => number;
}

type Entry = ExtractionOutput["fields"][number];

function segmentsOverlapping(doc: SourceDocument, citation: Citation) {
  return doc.segments.filter(
    (segment) => segment.start < citation.end && citation.start < segment.end,
  );
}

function anchor(
  doc: SourceDocument,
  entry: Entry,
): { citation: Citation } | { reason: UnverifiedReason } {
  const known = doc.segments.some(({ id }) => id === entry.segmentId);
  const citation =
    (known
      ? locateQuote(doc, entry.quote, { segmentId: entry.segmentId })
      : null) ?? locateQuote(doc, entry.quote);
  if (citation && verifyCitation(doc, citation)) return { citation };
  return {
    reason:
      countQuoteMatches(doc, entry.quote) > 1
        ? "quote_ambiguous"
        : "quote_not_found",
  };
}

/** Grounds one model entry in the source: our code decides its status. */
function review(
  doc: SourceDocument,
  entry: Entry,
  suspicious: ReadonlySet<string>,
): Omit<FieldReview, "note"> {
  const reasons: UnverifiedReason[] = [];
  const normalised = normaliseValue(entry.path, entry.value);
  if (!normalised.ok) reasons.push("value_unreadable");

  const anchored = anchor(doc, entry);
  const citation = "citation" in anchored ? anchored.citation : null;
  if ("reason" in anchored) reasons.push(anchored.reason);

  if (citation) {
    if (
      segmentsOverlapping(doc, citation).some(({ id }) => suspicious.has(id))
    ) {
      reasons.push("suspicious_passage");
    }
    if (
      normalised.ok &&
      !quoteSupportsValue(entry.path, normalised.value, citation.quote)
    ) {
      reasons.push("value_not_in_quote");
    }
  }

  return {
    path: entry.path,
    status: reasons.length === 0 ? "verified" : "unverified",
    value: normalised.ok ? normalised.value : null,
    text: entry.value,
    quote: entry.quote,
    citation,
    reasons: reasons.map((code) => ({
      code,
      message: reasonMessage(code, entry.path),
    })),
  };
}

/**
 * Grounds a model's answer in the source document. Every quote is anchored
 * and verified against the ingested text, every value is normalised to the
 * draft's type and checked against its quote, and passages that read like
 * instructions to an AI are distrusted. Values that fail are kept and marked
 * unverified with a reason, never dropped or trusted silently.
 */
export function groundExtraction(
  doc: SourceDocument,
  output: ExtractionOutput,
): Pick<ExtractionReview, "fields" | "result" | "suspiciousSegments"> {
  const suspiciousSegments = doc.segments
    .filter((segment) => looksLikeInstruction(segment.text))
    .map(({ id }) => id);
  const suspicious = new Set(suspiciousSegments);

  const entries = new Map<ExtractionFieldPath, Entry>();
  const duplicates = new Set<ExtractionFieldPath>();
  for (const entry of output.fields) {
    if (entries.has(entry.path)) duplicates.add(entry.path);
    else entries.set(entry.path, entry);
  }
  const notes = new Map<ExtractionFieldPath, string[]>();
  for (const { path, note } of output.notes) {
    const text = note.trim();
    if (text) notes.set(path, [...(notes.get(path) ?? []), text]);
  }

  const fields = extractionFieldPaths.map((path): FieldReview => {
    const note = notes.get(path)?.join(" ") ?? null;
    const entry = entries.get(path);
    if (!entry) {
      return {
        path,
        status: "absent",
        value: null,
        text: null,
        quote: null,
        citation: null,
        reasons: [],
        note,
      };
    }
    const reviewed = review(doc, entry, suspicious);
    if (duplicates.has(path)) {
      reviewed.status = "unverified";
      reviewed.reasons.push({
        code: "duplicate_field",
        message: reasonMessage("duplicate_field", path),
      });
    }
    return { ...reviewed, note };
  });

  const result = extractionResultSchema.parse({
    documentId: doc.id,
    promptVersion: EXTRACTION_PROMPT_VERSION,
    fields: fields.flatMap((field): ExtractedField[] =>
      field.value === null
        ? []
        : [{ path: field.path, value: field.value, citation: field.citation }],
    ),
  });

  return { fields, result, suspiciousSegments };
}

/**
 * Extracts Musterprotokoll draft fields from an ingested document with an
 * LLM. The model only proposes values and quotes through a schema-constrained
 * answer; `groundExtraction` decides what is verified. Throws an
 * `ExtractionError` when the document is too long or the call fails.
 */
export async function extractDraftFields(
  doc: SourceDocument,
  { client, model, effort = "medium", signal, now = Date.now }: ExtractOptions,
): Promise<ExtractionReview> {
  if (doc.text.length > MAX_EXTRACTION_CHARACTERS) {
    throw new ExtractionError("DOCUMENT_TOO_LONG");
  }
  const started = now();
  let answer;
  try {
    answer = await client.generateStructured({
      task: "extract",
      system: EXTRACTION_SYSTEM_PROMPT,
      user: extractionUserMessage(doc),
      schema: extractionOutputSchema,
      model,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      effort,
      cacheSystemPrompt: true,
      signal,
    });
  } catch (error) {
    if (isLlmError(error)) {
      throw new ExtractionError(error.kind, { cause: error });
    }
    throw error;
  }
  const latencyMs = now() - started;
  const grounded = groundExtraction(doc, answer.data);
  return {
    ...grounded,
    result: { ...grounded.result, model: answer.model },
    model: answer.model,
    promptVersion: EXTRACTION_PROMPT_VERSION,
    usage: answer.usage,
    latencyMs,
  };
}
