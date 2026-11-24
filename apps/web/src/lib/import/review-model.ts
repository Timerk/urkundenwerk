import type { MusterprotokollDraft } from "@urkundenwerk/core";
import {
  type ExtractionFieldPath,
  type FieldReview,
  fieldKind,
  isFieldValue,
} from "@urkundenwerk/extraction/contract";
import { formatEuroCents, formatIsoDate } from "../../i18n/format";
import type { Locale } from "../../i18n/locale";
import { formatEuros, parseEuros, setAt } from "../builder/form-model";
import { dateInputText, parseDateInput } from "../date-input";

// The review screen's state, kept free of React so it can be tested alone.

/** What the user decided for one extracted value. */
export type Decision =
  | { kind: "pending" }
  | { kind: "accepted" }
  | { kind: "edited"; value: string | number }
  | { kind: "cleared" };

export type Decisions = Partial<Record<ExtractionFieldPath, Decision>>;

/** The sections of the builder, in the deed's order; `review.sections.<id>` names them. */
export const REVIEW_SECTIONS = [
  { id: "notarisation", prefix: "notarisation." },
  { id: "founder", prefix: "founder." },
  { id: "company", prefix: "company." },
  { id: "capital", prefix: ["shareCapitalCents", "contribution"] },
  { id: "director", prefix: "managingDirector." },
  { id: "notes", prefix: ["notaryNotes"] },
] as const;

export function sectionOf(path: ExtractionFieldPath): string {
  return REVIEW_SECTIONS.find(({ prefix }) =>
    typeof prefix === "string"
      ? path.startsWith(prefix)
      : (prefix as readonly string[]).includes(path),
  )!.id;
}

/** Names an option of an enum field in the UI language. */
export type OptionLabel = (path: ExtractionFieldPath, value: string) => string;

/** The options of an enum field with their labels. */
export function fieldOptions(
  path: ExtractionFieldPath,
  optionLabel: OptionLabel,
): { value: string; label: string }[] {
  const kind = fieldKind(path);
  if (kind.type !== "enum") return [];
  return kind.values.map((value) => ({
    value,
    label: optionLabel(path, value),
  }));
}

/** A value as the review screen shows it, in the UI language's conventions. */
export function formatValue(
  path: ExtractionFieldPath,
  value: string | number,
  locale: Locale,
  optionLabel: OptionLabel,
): string {
  const kind = fieldKind(path);
  if (kind.type === "amount" && typeof value === "number") {
    return formatEuroCents(locale, value);
  }
  if (kind.type === "date" && typeof value === "string") {
    return formatIsoDate(locale, value);
  }
  if (kind.type === "enum") return optionLabel(path, String(value));
  return String(value);
}

/** The text an edit control starts with for a value. */
export function editText(
  path: ExtractionFieldPath,
  value: string | number | null,
  locale: Locale,
): string {
  if (value === null) return "";
  const kind = fieldKind(path).type;
  if (kind === "amount" && typeof value === "number") {
    return formatEuros(value, false, locale);
  }
  if (kind === "date" && typeof value === "string") {
    return dateInputText(locale, value);
  }
  return String(value);
}

/** Why an edit is not a value yet; `review.edit.<reason>` words most. */
export type EditProblem =
  | "amountMissing"
  | "amountFormat"
  | "amountRange"
  | "valueMissing"
  | "date"
  | "invalid";

export type EditResult =
  { ok: true; value: string | number } | { ok: false; problem: EditProblem };

/** Reads an edited value and checks it against the draft field's schema. */
export function parseEdit(
  path: ExtractionFieldPath,
  text: string,
  locale: Locale,
): EditResult {
  const kind = fieldKind(path);
  let value: string | number;
  if (kind.type === "amount") {
    const euros = parseEuros(text, false, locale);
    if (euros.kind === "empty") return { ok: false, problem: "amountMissing" };
    if (euros.kind === "invalid") {
      return {
        ok: false,
        problem: euros.reason === "format" ? "amountFormat" : "amountRange",
      };
    }
    value = euros.cents;
  } else if (kind.type === "date") {
    const date = parseDateInput(text);
    if (date.kind === "empty") return { ok: false, problem: "valueMissing" };
    if (date.kind === "invalid") return { ok: false, problem: "date" };
    value = date.iso;
  } else {
    value = text.trim();
    if (!value) return { ok: false, problem: "valueMissing" };
  }
  if (!isFieldValue(path, value)) {
    return { ok: false, problem: kind.type === "date" ? "date" : "invalid" };
  }
  return { ok: true, value };
}

/** Every extracted value starts undecided; absent fields need no decision. */
export function initialDecisions(fields: readonly FieldReview[]): Decisions {
  return Object.fromEntries(
    fields
      .filter(({ status }) => status !== "absent")
      .map(({ path }) => [path, { kind: "pending" }]),
  );
}

/** Accepts every verified value that is still undecided. */
export function acceptAllVerified(
  fields: readonly FieldReview[],
  decisions: Decisions,
): Decisions {
  const next = { ...decisions };
  for (const field of fields) {
    if (field.status === "verified" && next[field.path]?.kind === "pending") {
      next[field.path] = { kind: "accepted" };
    }
  }
  return next;
}

/** Fields that still need a decision, in form order. */
export function pendingFields(
  fields: readonly FieldReview[],
  decisions: Decisions,
): FieldReview[] {
  return fields.filter(({ path }) => decisions[path]?.kind === "pending");
}

/** The value a decision puts into the draft, or `undefined` for none. */
export function decidedValue(
  field: FieldReview,
  decision: Decision | undefined,
): string | number | undefined {
  if (decision?.kind === "edited") return decision.value;
  if (decision?.kind === "accepted" && field.value !== null) return field.value;
  return undefined;
}

type DecisionCounts = { accepted: number; edited: number; cleared: number };

/**
 * How many values of each extraction status the reviewer accepted, edited,
 * or cleared. Recorded as the import's provenance in the audit log, without
 * the values themselves.
 */
export function decisionCounts(
  fields: readonly FieldReview[],
  decisions: Decisions,
): Record<FieldReview["status"], DecisionCounts> {
  const counts = {
    verified: { accepted: 0, edited: 0, cleared: 0 },
    unverified: { accepted: 0, edited: 0, cleared: 0 },
    absent: { accepted: 0, edited: 0, cleared: 0 },
  };
  for (const field of fields) {
    const kind = decisions[field.path]?.kind;
    if (kind && kind !== "pending") counts[field.status][kind] += 1;
  }
  return counts;
}

/** The draft that confirming creates: accepted and edited values only. */
export function draftFromDecisions(
  fields: readonly FieldReview[],
  decisions: Decisions,
): MusterprotokollDraft {
  let draft: MusterprotokollDraft = {};
  for (const field of fields) {
    const value = decidedValue(field, decisions[field.path]);
    if (value !== undefined) draft = setAt(draft, field.path, value);
  }
  return draft;
}
