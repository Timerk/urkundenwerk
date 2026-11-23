import { formatEuroInWords, formatGermanDate } from "@urkundenwerk/core";
import { fieldKind } from "../fields";
import {
  isFieldValue,
  type ExtractionFieldPath,
  type ExtractionFieldValue,
} from "../result";
import { normalizeText } from "../source";

// The checks in this file decide whether an extracted value is shown as
// verified. They run in our code on the model's output and the ingested
// text, so a model cannot mark its own answer as supported (ADR-0009).

const MONTHS = [
  "januar",
  "februar",
  "märz",
  "april",
  "mai",
  "juni",
  "juli",
  "august",
  "september",
  "oktober",
  "november",
  "dezember",
];
const MONTH_ALIASES: Record<string, number> = {
  ...Object.fromEntries(MONTHS.map((name, index) => [name, index + 1])),
  maerz: 3,
  jänner: 1,
  jan: 1,
  feb: 2,
  mär: 3,
  mrz: 3,
  apr: 4,
  jun: 6,
  jul: 7,
  aug: 8,
  sep: 9,
  sept: 9,
  okt: 10,
  nov: 11,
  dez: 12,
};

/** Lowercase, NFC, collapsed whitespace: the form text is compared in. */
export function fold(text: string): string {
  return normalizeText(text).toLowerCase();
}

function isoDate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Reads ISO, `7.3.1990`, `07.03.1990`, and `7. März 1990`. */
export function parseDate(text: string): string | undefined {
  const value = fold(text).replace(/^(?:am|den)\s+/u, "");
  let match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (match) return isoDate(+match[1]!, +match[2]!, +match[3]!);
  match = /^(\d{1,2})\.\s?(\d{1,2})\.\s?(\d{4})$/u.exec(value);
  if (match) return isoDate(+match[3]!, +match[2]!, +match[1]!);
  match = /^(\d{1,2})\.\s?([\p{L}]+)\.?\s(\d{4})$/u.exec(value);
  const month = match ? MONTH_ALIASES[match[2]!] : undefined;
  if (match && month) return isoDate(+match[3]!, month, +match[1]!);
  return undefined;
}

// Text is normalised first, which turns non-breaking spaces into spaces.
const EURO_NUMBER =
  /(?<![\d.,])(\d{1,3}(?:[. ]\d{3})+|\d+)(?:,(\d{1,2}|-{1,2}))?(?![\d])/gu;

/** Reads euro amounts written as digits, e.g. `25.000`, `25 000,00 €`, `EUR 640`. */
export function parseEuroCents(text: string): number | undefined {
  const value = normalizeText(text)
    .replace(/^(?:eur|euro|€)\s*/iu, "")
    .replace(/\s*(?:eur|euro|€)$/iu, "")
    .trim();
  const match = /^(\d{1,3}(?:[. ]\d{3})+|\d+)(?:[,.](\d{2}|-{1,2}))?$/u.exec(
    value,
  );
  if (!match) return undefined;
  const euros = Number(match[1]!.replace(/[. ]/gu, ""));
  const cents = match[2] && /^\d+$/u.test(match[2]) ? Number(match[2]) : 0;
  const total = euros * 100 + cents;
  return Number.isSafeInteger(total) ? total : undefined;
}

const ENUM_SYNONYMS: Partial<
  Record<ExtractionFieldPath, Record<string, string>>
> = {
  "notarisation.mode": {
    "in person": "in_person",
    "in-person": "in_person",
    persönlich: "in_person",
    "video communication": "video",
  },
  "founder.kind": {
    "natural person": "natural_person",
    "legal entity": "legal_entity",
  },
  "founder.salutation": { herrn: "Herr" },
  "managingDirector.salutation": { herrn: "Herr" },
};

export type Normalised =
  { ok: true; value: Exclude<ExtractionFieldValue, null> } | { ok: false };

/**
 * Turns the model's text into the draft's type: ISO dates, integer cents,
 * and enum values. The result must also pass the draft field's schema.
 */
export function normaliseValue(
  path: ExtractionFieldPath,
  raw: string,
): Normalised {
  const text = normalizeText(raw);
  if (!text) return { ok: false };
  const kind = fieldKind(path);
  let value: Exclude<ExtractionFieldValue, null> | undefined;
  switch (kind.type) {
    case "date":
      value = parseDate(text);
      break;
    case "amount":
      value = parseEuroCents(text);
      break;
    case "enum": {
      const lower = text.toLowerCase();
      value =
        kind.values.find((option) => option.toLowerCase() === lower) ??
        ENUM_SYNONYMS[path]?.[lower];
      break;
    }
    case "text":
    case "freeText":
      value = text;
  }
  return value !== undefined && isFieldValue(path, value)
    ? { ok: true, value }
    : { ok: false };
}

function tokens(text: string): string[] {
  return fold(text).match(/[\p{L}\p{M}\p{N}]+/gu) ?? [];
}

/**
 * Every word of the value appears in the quote, allowing German inflection
 * endings (Amtsgericht → des Amtsgerichts, Herr → Herrn).
 */
function wordsAppear(value: string, quote: string): boolean {
  const wanted = tokens(value);
  const available = tokens(quote);
  return (
    wanted.length > 0 &&
    wanted.every((word) =>
      available.some(
        (candidate) =>
          candidate === word ||
          (candidate.startsWith(word) && candidate.length - word.length <= 2),
      ),
    )
  );
}

function compact(text: string): string {
  return fold(text).replace(/[\s-]+/gu, "");
}

function amountAppears(cents: number, quote: string): boolean {
  for (const match of normalizeText(quote).matchAll(EURO_NUMBER)) {
    if (parseEuroCents(match[0]) === cents) return true;
  }
  if (cents % 100 !== 0 || cents < 100) return false;
  // The amount in words, as deeds write it: "fünfundzwanzigtausend Euro".
  const words = compact(formatEuroInWords(cents / 100));
  const haystack = compact(quote);
  return [
    words,
    words.replace(/^einhundert/u, "hundert"),
    words.replace(/^eintausend/u, "tausend"),
  ].some((form) => haystack.includes(form));
}

function dateAppears(iso: string, quote: string): boolean {
  const [year, month, day] = iso.split("-").map(Number) as [
    number,
    number,
    number,
  ];
  const haystack = compact(quote);
  const dd = String(day).padStart(2, "0");
  const mm = String(month).padStart(2, "0");
  const monthName = MONTHS[month - 1]!;
  const forms = [
    iso,
    `${dd}.${mm}.${year}`,
    `${day}.${month}.${year}`,
    `${dd}.${month}.${year}`,
    `${day}.${mm}.${year}`,
    formatGermanDate(iso),
    `${dd}. ${monthName} ${year}`,
    `${day}. ${monthName.slice(0, 3)}. ${year}`,
  ];
  return forms.some((form) => haystack.includes(compact(form)));
}

// Cues for classification fields where wording reliably shows the value. A
// value whose cue is missing from its quote is not shown as verified.
const ENUM_CUES: Partial<
  Record<ExtractionFieldPath, Record<string, RegExp | null>>
> = {
  "founder.salutation": { Herr: /\bherrn?\b/u, Frau: /\bfrau\b/u },
  "managingDirector.salutation": { Herr: /\bherrn?\b/u, Frau: /\bfrau\b/u },
  contribution: {
    full: /voll|gesamt|ganz|100\s?(?:%|prozent)/u,
    half: /hälfte|halb|50\s?(?:%|prozent)/u,
  },
  "founder.kind": {
    legal_entity:
      /\b(?:gmbh|mbh|ag|kg|ohg|se|ug|e\.\s?g\.|e\.\s?v\.)\b|gesellschaft|register|\bhr[ab]\b/u,
    natural_person: null,
  },
  "notarisation.mode": {
    video: /video|bild- und ton|bild und ton|online/u,
    in_person: null,
  },
};

/**
 * Whether the quote plausibly states the value. Text must appear word for
 * word (with inflection endings), amounts and dates in a German or ISO
 * format, and classification values must have their cue where one is known.
 */
export function quoteSupportsValue(
  path: ExtractionFieldPath,
  value: Exclude<ExtractionFieldValue, null>,
  quote: string,
): boolean {
  const kind = fieldKind(path);
  switch (kind.type) {
    case "text":
    case "freeText":
      return typeof value === "string" && wordsAppear(value, quote);
    case "date":
      return typeof value === "string" && dateAppears(value, quote);
    case "amount":
      return typeof value === "number" && amountAppears(value, quote);
    case "enum": {
      const cues = ENUM_CUES[path];
      if (!cues) return true;
      const folded = fold(quote);
      const cue = cues[String(value)];
      if (cue) return cue.test(folded);
      // A value without its own cue must not carry another value's cue, e.g.
      // "in_person" for a passage that describes a video notarisation.
      return Object.entries(cues).every(
        ([option, other]) => option === value || !other || !other.test(folded),
      );
    }
  }
}

const INSTRUCTION_PATTERNS = [
  /\b(?:ignore|disregard|forget)\b.{0,40}\b(?:instructions?|rules|prompt|above)\b/u,
  /\b(?:ignoriere|ignorieren|vergiss|missachte)\w*\b.{0,60}\b(?:anweisung|anweisungen|regeln|vorgaben|prompt)\b/u,
  /\b(?:system prompt|systemprompt|you are an? (?:ai|assistant|language model)|as an ai)\b/u,
  /\b(?:ki|ai|llm|chatbot|sprachmodell|assistant|assistent)\b.{0,60}\b(?:soll|must|should|set|setze|trage|antworte|answer|extract|extrahiere)\w*\b/u,
  /\b(?:set|change)\b.{0,40}\b(?:the )?(?:value|field|share capital|stammkapital)\b.{0,20}\bto\b/u,
];

/** Whether a passage reads like an instruction to an AI rather than contract text. */
export function looksLikeInstruction(text: string): boolean {
  const folded = fold(text);
  return INSTRUCTION_PATTERNS.some((pattern) => pattern.test(folded));
}
